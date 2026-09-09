import type { PrismaClient } from "../db/client";
import type { Logger } from "../logging/logger";
import type { Services } from "../services";

/** Per-request context handed to every resolver. */
export interface GraphQLContext {
  db: PrismaClient;
  /** Child logger carrying `requestId` (and `correlationId` when the client supplied one). */
  logger: Logger;
  requestId: string;
  services: Services;
}
