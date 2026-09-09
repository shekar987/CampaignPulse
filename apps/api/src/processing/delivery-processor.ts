import {
  DeliveryEventSchema,
  readSimulationParams,
  type Channel,
  type DeliveryEvent,
  type EventType,
  type SimulationParams,
} from "@campaignpulse/event-contracts";
import {
  MAX_DELIVERY_ATTEMPTS,
  RETRY_BACKOFF_SECONDS,
  decideRetry,
  transitionSources,
} from "@campaignpulse/shared";

import type { PrismaClient } from "../db/client";
import type { EventBus } from "../events/event-bus";
import { createEvent, toEventRow } from "../events/event-mapper";
import { Prisma } from "../generated/prisma/client";
import type { Logger } from "../logging/logger";
import type { NotificationPublisher } from "../notifications/notification-publisher";
import { simulateAttempt } from "../simulation/channel-simulator";
import { ValidationError } from "../services/errors";
import type { HealthService } from "../services/health-service";
import type { IncidentService } from "../services/incident-service";

export interface DeliveryProcessorOptions {
  maxAttempts?: number;
  backoffSeconds?: readonly number[];
  /** Multiplier applied to simulated latency before the worker waits for it. */
  latencyScale?: number;
  clock?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface DeliveryProcessorDependencies {
  db: PrismaClient;
  bus: EventBus;
  health: HealthService;
  incidents: IncidentService;
  notifications: NotificationPublisher;
  logger: Logger;
  options?: DeliveryProcessorOptions;
}

export type AttemptResult = "success" | "retry-scheduled" | "dead-lettered";

export type ProcessingResult =
  | { status: "duplicate"; eventId: string }
  | { status: "ignored"; eventId: string; reason: string }
  | {
      status: "processed";
      eventId: string;
      campaignId: string;
      channel: Channel;
      correlationId: string;
      attempt: number;
      result: AttemptResult;
    };

export interface BatchResult {
  results: ProcessingResult[];
  /** Events whose processing threw; the transport should redeliver them. */
  failures: { eventId: string; error: unknown }[];
}

const ACTIONABLE_EVENT_TYPES: readonly EventType[] = [
  "CAMPAIGN_DELIVERY_REQUESTED",
  "DELIVERY_RETRY_REQUESTED",
];

const DEFAULT_PARAMS: SimulationParams = { runId: "adhoc", scenario: "CUSTOM", failureRate: 0 };

class DuplicateEventError extends Error {}
class StaleEventError extends Error {}

interface TransactionOutcome {
  result: ProcessingResult;
  retry?: { event: DeliveryEvent; delaySeconds: number };
  deadLetter?: { correlationId: string; reason: string; errorCode: string; message: string };
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Returns `candidate` if it is later than `reference`, otherwise one millisecond after it. */
function strictlyAfter(candidate: Date, reference: Date): Date {
  return candidate.getTime() > reference.getTime() ? candidate : new Date(reference.getTime() + 1);
}

/**
 * Consumes delivery request events and performs the (simulated) delivery attempt.
 *
 * Correctness properties, in order of importance:
 * 1. Idempotent: the event id is claimed in `processed_events` inside the same transaction as
 *    every side effect, so a redelivered message is skipped and a crashed attempt is retried.
 * 2. Race-safe: status transitions are guarded `UPDATE ... WHERE status IN (...)` statements, so a
 *    late retry can never overwrite a delivery that already succeeded.
 * 3. Bounded: the retry policy (max attempts, exponential backoff, non-retryable errors) decides
 *    between scheduling the next attempt and dead-lettering.
 */
export class DeliveryProcessor {
  private readonly db: PrismaClient;
  private readonly bus: EventBus;
  private readonly health: HealthService;
  private readonly incidents: IncidentService;
  private readonly notifications: NotificationPublisher;
  private readonly logger: Logger;
  private readonly maxAttempts: number;
  private readonly backoffSeconds: readonly number[];
  private readonly latencyScale: number;
  private readonly clock: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(deps: DeliveryProcessorDependencies) {
    this.db = deps.db;
    this.bus = deps.bus;
    this.health = deps.health;
    this.incidents = deps.incidents;
    this.notifications = deps.notifications;
    this.logger = deps.logger.child({ component: "delivery-processor" });
    this.maxAttempts = deps.options?.maxAttempts ?? MAX_DELIVERY_ATTEMPTS;
    this.backoffSeconds = deps.options?.backoffSeconds ?? RETRY_BACKOFF_SECONDS;
    this.latencyScale = deps.options?.latencyScale ?? 0.05;
    this.clock = deps.options?.clock ?? (() => new Date());
    this.sleep = deps.options?.sleep ?? defaultSleep;
  }

  /** Handles one event end to end, including health and incident evaluation. */
  async handle(event: DeliveryEvent): Promise<ProcessingResult> {
    const batch = await this.handleBatch([event]);
    const failure = batch.failures[0];
    if (failure) {
      throw failure.error;
    }
    const result = batch.results[0];
    if (!result) {
      throw new Error("No processing result produced");
    }
    return result;
  }

  /**
   * Handles a batch (an SQS poll or a local drain). Health and incidents are evaluated once per
   * touched campaign channel after the batch, not once per event.
   */
  async handleBatch(events: DeliveryEvent[]): Promise<BatchResult> {
    const results: ProcessingResult[] = [];
    const failures: BatchResult["failures"] = [];
    const touched = new Map<string, { campaignId: string; channel: Channel }>();

    for (const raw of events) {
      try {
        const result = await this.processOne(raw);
        results.push(result);
        if (result.status === "processed") {
          touched.set(`${result.campaignId}:${result.channel}`, {
            campaignId: result.campaignId,
            channel: result.channel,
          });
        }
      } catch (error) {
        this.logger.error({ err: error, eventId: raw.id }, "event processing failed");
        failures.push({ eventId: raw.id, error });
      }
    }

    await this.evaluateHealth([...touched.values()]);
    return { results, failures };
  }

  private async processOne(raw: DeliveryEvent): Promise<ProcessingResult> {
    const parsed = DeliveryEventSchema.safeParse(raw);
    if (!parsed.success) {
      throw ValidationError.fromZod(parsed.error, "Delivery event is malformed");
    }
    const event = parsed.data;
    const log = this.logger.child({
      eventId: event.id,
      correlationId: event.correlationId,
      campaignId: event.campaignId,
      channel: event.channel,
    });

    if (!ACTIONABLE_EVENT_TYPES.includes(event.eventType)) {
      return {
        status: "ignored",
        eventId: event.id,
        reason: `${event.eventType} is not actionable`,
      };
    }

    let outcome: TransactionOutcome;
    try {
      outcome = await this.db.$transaction((tx) => this.attempt(tx, event, log), {
        maxWait: 5_000,
        timeout: 30_000,
      });
    } catch (error) {
      if (error instanceof DuplicateEventError) {
        log.info("duplicate event skipped");
        return { status: "duplicate", eventId: event.id };
      }
      if (error instanceof StaleEventError) {
        log.warn({ reason: error.message }, "stale event ignored");
        return { status: "ignored", eventId: event.id, reason: error.message };
      }
      throw error;
    }

    if (outcome.retry) {
      await this.bus.publish(outcome.retry.event, { delaySeconds: outcome.retry.delaySeconds });
      log.info(
        { nextAttempt: outcome.retry.event.attempt, delaySeconds: outcome.retry.delaySeconds },
        "retry scheduled",
      );
    }
    if (outcome.deadLetter) {
      await this.notifications.publish({
        type: "DELIVERY_DEAD_LETTERED",
        subject: `Delivery dead-lettered: ${outcome.deadLetter.reason}`,
        message: `Delivery ${outcome.deadLetter.correlationId} on ${event.channel} gave up after ${event.attempt} attempt(s): ${outcome.deadLetter.errorCode} ${outcome.deadLetter.message}`,
        attributes: {
          campaignId: event.campaignId,
          channel: event.channel,
          correlationId: outcome.deadLetter.correlationId,
          reason: outcome.deadLetter.reason,
          errorCode: outcome.deadLetter.errorCode,
        },
      });
    }
    return outcome.result;
  }

  private async attempt(
    tx: Prisma.TransactionClient,
    event: DeliveryEvent,
    log: Logger,
  ): Promise<TransactionOutcome> {
    // 1. Claim the event id. A unique violation means this message was already processed.
    try {
      await tx.processedEvent.create({ data: { eventId: event.id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new DuplicateEventError();
      }
      throw error;
    }

    // 2. Load (or adopt) the delivery this event belongs to.
    const paramsFromEvent = readSimulationParams(event.metadata);
    let delivery = await tx.delivery.findUnique({ where: { correlationId: event.correlationId } });
    if (!delivery) {
      delivery = await tx.delivery.create({
        data: {
          correlationId: event.correlationId,
          campaignId: event.campaignId,
          channel: event.channel,
          status: "PENDING",
          attempts: 0,
          simulation: (paramsFromEvent as unknown as Prisma.InputJsonValue | null) ?? undefined,
          requestedAt: new Date(event.occurredAt),
        },
      });
    }
    const params =
      readSimulationParams({ simulation: delivery.simulation }) ??
      paramsFromEvent ??
      DEFAULT_PARAMS;

    // 3. Guard the transition into PROCESSING. Stale or out-of-order messages stop here.
    const attempt = event.attempt;
    const allowedFrom = transitionSources("PROCESSING");
    if (!allowedFrom.includes(delivery.status)) {
      throw new StaleEventError(`delivery is already ${delivery.status}`);
    }
    if (attempt !== delivery.attempts + 1) {
      throw new StaleEventError(
        `attempt ${attempt} does not follow ${delivery.attempts} recorded attempt(s)`,
      );
    }
    const started = await tx.delivery.updateMany({
      where: {
        correlationId: event.correlationId,
        status: { in: allowedFrom },
        attempts: delivery.attempts,
      },
      data: { status: "PROCESSING", attempts: attempt },
    });
    if (started.count === 0) {
      throw new StaleEventError("delivery was claimed by another worker");
    }

    const base = {
      campaignId: event.campaignId,
      correlationId: event.correlationId,
      channel: event.channel,
      attempt,
    };
    const runMetadata = {
      runId: params.runId,
      ...(params.replayOf ? { replayOf: params.replayOf } : {}),
    };

    const startedAt = this.clock();
    await tx.deliveryEvent.create({
      data: toEventRow(
        createEvent({
          ...base,
          eventType: "DELIVERY_STARTED",
          status: "PROCESSING",
          occurredAt: startedAt,
          metadata: runMetadata,
        }),
      ),
    });

    // 4. Perform the simulated channel call.
    const outcome = simulateAttempt(params, event.channel, event.correlationId, attempt);
    await this.sleep(Math.round(outcome.latencyMs * this.latencyScale));
    // Timeline order must be unambiguous even when the clock has not ticked: the outcome
    // strictly follows the start, and a retry request or final failure strictly follows it.
    const finishedAt = strictlyAfter(this.clock(), startedAt);
    const followUpAt = strictlyAfter(finishedAt, finishedAt);

    if (outcome.kind === "success") {
      await tx.deliveryEvent.create({
        data: toEventRow(
          createEvent({
            ...base,
            eventType: attempt === 1 ? "DELIVERY_SUCCEEDED" : "DELIVERY_RETRY_SUCCEEDED",
            status: "SUCCESS",
            occurredAt: finishedAt,
            metadata: { ...runMetadata, latencyMs: outcome.latencyMs },
          }),
        ),
      });
      await tx.delivery.update({
        where: { correlationId: event.correlationId },
        data: {
          status: "SUCCESS",
          completedAt: finishedAt,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      log.info({ attempt, latencyMs: outcome.latencyMs }, "delivery succeeded");
      return {
        result: { status: "processed", eventId: event.id, ...base, result: "success" },
      };
    }

    // 5. Failure: record it, then either schedule a retry or dead-letter the delivery.
    const error = { code: outcome.errorCode, message: outcome.errorMessage };
    await tx.deliveryEvent.create({
      data: toEventRow(
        createEvent({
          ...base,
          eventType: "DELIVERY_FAILED",
          status: "FAILED",
          occurredAt: finishedAt,
          metadata: { ...runMetadata, latencyMs: outcome.latencyMs },
          error,
        }),
      ),
    });
    log.warn(
      { attempt, errorCode: error.code, latencyMs: outcome.latencyMs },
      "delivery attempt failed",
    );

    const decision = decideRetry(outcome.errorCode, attempt, {
      maxAttempts: this.maxAttempts,
      backoffSeconds: this.backoffSeconds,
    });

    if (decision.action === "retry") {
      const retryEvent = createEvent({
        ...base,
        attempt: decision.nextAttempt,
        eventType: "DELIVERY_RETRY_REQUESTED",
        status: "RETRYING",
        occurredAt: followUpAt,
        metadata: {
          ...runMetadata,
          simulation: params,
          delaySeconds: decision.delaySeconds,
          previousError: error.code,
        },
      });
      await tx.deliveryEvent.create({ data: toEventRow(retryEvent) });
      await tx.delivery.update({
        where: { correlationId: event.correlationId },
        data: { status: "RETRYING", lastErrorCode: error.code, lastErrorMessage: error.message },
      });
      return {
        result: { status: "processed", eventId: event.id, ...base, result: "retry-scheduled" },
        retry: { event: retryEvent, delaySeconds: decision.delaySeconds },
      };
    }

    await tx.deliveryEvent.create({
      data: toEventRow(
        createEvent({
          ...base,
          eventType: "DELIVERY_FINAL_FAILURE",
          status: "FINAL_FAILURE",
          occurredAt: followUpAt,
          metadata: { ...runMetadata, reason: decision.reason, attempts: attempt },
          error,
        }),
      ),
    });
    await tx.delivery.update({
      where: { correlationId: event.correlationId },
      data: {
        status: "FINAL_FAILURE",
        completedAt: finishedAt,
        lastErrorCode: error.code,
        lastErrorMessage: error.message,
      },
    });
    await tx.deadLetterEntry.upsert({
      where: { correlationId: event.correlationId },
      create: {
        campaignId: event.campaignId,
        correlationId: event.correlationId,
        channel: event.channel,
        attempts: attempt,
        lastErrorCode: error.code,
        lastErrorMessage: error.message,
        reason: decision.reason,
        payload: event as unknown as Prisma.InputJsonValue,
        enqueuedAt: finishedAt,
      },
      update: {
        attempts: attempt,
        lastErrorCode: error.code,
        lastErrorMessage: error.message,
        reason: decision.reason,
        payload: event as unknown as Prisma.InputJsonValue,
        status: "PENDING",
        enqueuedAt: finishedAt,
      },
    });
    log.error(
      { attempt, errorCode: error.code, reason: decision.reason },
      "delivery dead-lettered",
    );
    return {
      result: { status: "processed", eventId: event.id, ...base, result: "dead-lettered" },
      deadLetter: {
        correlationId: event.correlationId,
        reason: decision.reason,
        errorCode: error.code,
        message: error.message,
      },
    };
  }

  private async evaluateHealth(pairs: { campaignId: string; channel: Channel }[]): Promise<void> {
    const campaignIds = [...new Set(pairs.map((pair) => pair.campaignId))];
    for (const campaignId of campaignIds) {
      try {
        await this.health.recalculateCampaign(campaignId);
      } catch (error) {
        this.logger.error({ err: error, campaignId }, "health recalculation failed");
      }
    }
    for (const pair of pairs) {
      try {
        await this.incidents.evaluateChannel(pair.campaignId, pair.channel);
      } catch (error) {
        this.logger.error({ err: error, ...pair }, "incident evaluation failed");
      }
    }
  }
}
