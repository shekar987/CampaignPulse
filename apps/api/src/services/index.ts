import type { PrismaClient } from "../db/client";
import type { EventBus } from "../events/event-bus";
import type { Logger } from "../logging/logger";
import type { NotificationPublisher } from "../notifications/notification-publisher";
import { CampaignService } from "./campaign-service";
import { DeadLetterService } from "./dead-letter-service";
import { DeliveryEventService } from "./delivery-event-service";
import { HealthService } from "./health-service";
import { IncidentService } from "./incident-service";
import { MetricsService } from "./metrics-service";
import { SimulationService } from "./simulation-service";
import { SystemHealthService } from "./system-health-service";
import type { SystemService } from "./system-service";

export interface Services {
  campaigns: CampaignService;
  events: DeliveryEventService;
  health: HealthService;
  metrics: MetricsService;
  incidents: IncidentService;
  deadLetters: DeadLetterService;
  simulation: SimulationService;
  systemHealth: SystemHealthService;
  system: SystemService;
}

export interface ServiceDependencies {
  db: PrismaClient;
  logger: Logger;
  system: SystemService;
  bus: EventBus;
  notifications: NotificationPublisher;
}

/** Wires the service graph. Services are plain classes, so tests can construct them directly. */
export function buildServices({
  db,
  logger,
  system,
  bus,
  notifications,
}: ServiceDependencies): Services {
  const metrics = new MetricsService(db);
  const incidents = new IncidentService(db, metrics, notifications, logger);
  const deadLetters = new DeadLetterService(db, bus, notifications, logger);
  const campaigns = new CampaignService(db, metrics, logger);
  return {
    campaigns,
    events: new DeliveryEventService(db),
    health: new HealthService(db, metrics, logger),
    metrics,
    incidents,
    deadLetters,
    simulation: new SimulationService(db, bus, logger),
    systemHealth: new SystemHealthService(db, metrics, campaigns, incidents, deadLetters),
    system,
  };
}

export { AppError, NotFoundError, ValidationError } from "./errors";
export type { ValidationIssue } from "./errors";
export { CampaignService } from "./campaign-service";
export type {
  CampaignChannelView,
  CampaignHealthView,
  CampaignListParams,
  CampaignSort,
  CampaignView,
} from "./campaign-service";
export { DeliveryEventService } from "./delivery-event-service";
export type { DeliveryEventListParams, DeliveryEventView } from "./delivery-event-service";
export { HealthService } from "./health-service";
export { MetricsService } from "./metrics-service";
export { IncidentService } from "./incident-service";
export type {
  IncidentEvaluation,
  IncidentListParams,
  IncidentSeverity,
  IncidentStatus,
  IncidentView,
} from "./incident-service";
export { DeadLetterService } from "./dead-letter-service";
export type {
  DeadLetterListParams,
  DeadLetterStatus,
  DeadLetterView,
  ReplayResult,
} from "./dead-letter-service";
export { SimulationService, simulateDeliveryInputSchema } from "./simulation-service";
export type { SimulateDeliveryInput, SimulationRunView } from "./simulation-service";
export { SYSTEM_HEALTH_WINDOW_HOURS, SystemHealthService } from "./system-health-service";
export { SystemService } from "./system-service";
export type { Page, PageParams } from "./pagination";
export { MAX_PAGE_SIZE } from "./pagination";
