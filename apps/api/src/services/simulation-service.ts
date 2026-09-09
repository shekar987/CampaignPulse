import { randomUUID } from "node:crypto";

import {
  ChannelSchema,
  SimulationScenarioSchema,
  type Channel,
  type SimulationScenario,
} from "@campaignpulse/event-contracts";
import { CUSTOM_SIMULATION_LIMITS } from "@campaignpulse/shared";
import { z } from "zod";

import type { PrismaClient } from "../db/client";
import type { EventBus } from "../events/event-bus";
import { createEvent, toEventRow } from "../events/event-mapper";
import type { Prisma } from "../generated/prisma/client";
import type { Logger } from "../logging/logger";
import { planSimulation } from "../simulation/planner";
import { NotFoundError, ValidationError } from "./errors";

export const simulateDeliveryInputSchema = z.object({
  campaignId: z.uuid("campaignId must be a UUID"),
  channels: z.array(ChannelSchema).min(1).nullish(),
  scenario: SimulationScenarioSchema,
  deliveries: z
    .number()
    .int()
    .min(CUSTOM_SIMULATION_LIMITS.minDeliveries)
    .max(CUSTOM_SIMULATION_LIMITS.maxDeliveries)
    .nullish(),
  failureRate: z.number().min(0).max(1).nullish(),
  seed: z.number().int().min(0).max(2_147_483_647).nullish(),
});

export type SimulateDeliveryInput = z.infer<typeof simulateDeliveryInputSchema>;

export interface SimulationRunView {
  id: string;
  campaignId: string;
  channels: Channel[];
  scenario: SimulationScenario;
  deliveries: number;
  seed: number;
  startedAt: Date;
}

/**
 * Turns a scenario into delivery requests: one `deliveries` row and one
 * CAMPAIGN_DELIVERY_REQUESTED event per delivery, persisted first and then published to the
 * event bus for the workers to pick up.
 */
export class SimulationService {
  constructor(
    private readonly db: PrismaClient,
    private readonly bus: EventBus,
    private readonly logger: Logger,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async run(input: unknown): Promise<SimulationRunView> {
    const parsed = simulateDeliveryInputSchema.safeParse(input);
    if (!parsed.success) {
      throw ValidationError.fromZod(parsed.error, "Simulation request is invalid");
    }
    const request = parsed.data;

    const campaign = await this.db.campaign.findUnique({
      where: { id: request.campaignId },
      include: { channels: true },
    });
    if (!campaign) {
      throw new NotFoundError("Campaign", request.campaignId);
    }

    const configured = campaign.channels.map((row) => row.channel);
    const channels = request.channels ?? configured;
    const unknown = channels.filter((channel) => !configured.includes(channel));
    if (unknown.length > 0) {
      throw new ValidationError("Simulation request is invalid", [
        {
          path: "channels",
          message: `Campaign is not configured for: ${unknown.join(", ")}`,
        },
      ]);
    }

    const runId = randomUUID().slice(0, 8);
    const seed = request.seed ?? Math.floor(Math.random() * 2_147_483_647);
    const plan = planSimulation(
      {
        scenario: request.scenario,
        deliveries: request.deliveries ?? undefined,
        failureRate: request.failureRate ?? undefined,
      },
      { runId, seed, campaignSlug: campaign.id.slice(0, 8), channels },
    );

    const startedAt = this.clock();
    const events = plan.deliveries.map((delivery) =>
      createEvent({
        campaignId: campaign.id,
        correlationId: delivery.correlationId,
        eventType: "CAMPAIGN_DELIVERY_REQUESTED",
        channel: delivery.channel,
        status: "PENDING",
        attempt: 1,
        occurredAt: startedAt,
        metadata: { runId, simulation: delivery.simulation },
      }),
    );

    await this.db.$transaction(async (tx) => {
      if (campaign.status === "DRAFT") {
        await tx.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } });
        this.logger.info({ campaignId: campaign.id }, "campaign activated by first simulation");
      }
      await tx.delivery.createMany({
        data: plan.deliveries.map((delivery): Prisma.DeliveryCreateManyInput => ({
          correlationId: delivery.correlationId,
          campaignId: campaign.id,
          channel: delivery.channel,
          status: "PENDING",
          attempts: 0,
          simulation: delivery.simulation as unknown as Prisma.InputJsonValue,
          requestedAt: startedAt,
        })),
      });
      await tx.deliveryEvent.createMany({ data: events.map(toEventRow) });
    });

    await this.bus.publishBatch(events);

    this.logger.info(
      {
        campaignId: campaign.id,
        runId,
        scenario: request.scenario,
        channels,
        deliveries: events.length,
        seed,
      },
      "simulation run published",
    );

    return {
      id: runId,
      campaignId: campaign.id,
      channels,
      scenario: request.scenario,
      deliveries: events.length,
      seed,
      startedAt,
    };
  }
}
