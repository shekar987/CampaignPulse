import type { PrismaClient } from "../db/client";
import type { Logger } from "../logging/logger";
import { CampaignService } from "./campaign-service";
import { DeliveryEventService } from "./delivery-event-service";
import { HealthService } from "./health-service";
import { MetricsService } from "./metrics-service";
import { SystemHealthService } from "./system-health-service";
import type { SystemService } from "./system-service";

export interface Services {
  campaigns: CampaignService;
  events: DeliveryEventService;
  health: HealthService;
  metrics: MetricsService;
  systemHealth: SystemHealthService;
  system: SystemService;
}

export interface ServiceDependencies {
  db: PrismaClient;
  logger: Logger;
  system: SystemService;
}

/** Wires the service graph. Services are plain classes, so tests can construct them directly. */
export function buildServices({ db, logger, system }: ServiceDependencies): Services {
  const metrics = new MetricsService(db);
  const campaigns = new CampaignService(db, metrics, logger);
  return {
    campaigns,
    events: new DeliveryEventService(db),
    health: new HealthService(db, metrics, logger),
    metrics,
    systemHealth: new SystemHealthService(db, metrics, campaigns),
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
export { SYSTEM_HEALTH_WINDOW_HOURS, SystemHealthService } from "./system-health-service";
export { SystemService } from "./system-service";
export type { Page, PageParams } from "./pagination";
export { MAX_PAGE_SIZE } from "./pagination";
