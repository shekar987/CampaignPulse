import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { format } from "node:util";

import type { ASTNode, Source } from "graphql";
import {
  createGraphQLError,
  createSchema,
  createYoga,
  maskError,
  type Plugin,
  type YogaInitialContext,
  type YogaLogger,
} from "graphql-yoga";

import type { AppConfig } from "./config";
import type { PrismaClient } from "./db/client";
import type { EventBus } from "./events/event-bus";
import type { GraphQLContext } from "./graphql/context";
import { resolvers } from "./graphql/resolvers";
import type { Logger } from "./logging/logger";
import type { NotificationPublisher } from "./notifications/notification-publisher";
import { AppError, SystemService, buildServices } from "./services";

export interface AppDependencies {
  db: PrismaClient;
  logger: Logger;
  config: AppConfig;
  version: string;
  bus: EventBus;
  notifications: NotificationPublisher;
}

export type App = ReturnType<typeof createApp>;

const typeDefs = readFileSync(new URL("./graphql/schema.graphql", import.meta.url), "utf8");

/**
 * Builds the GraphQL application. It is transport-agnostic: `server.ts` mounts it on a Node
 * HTTP server for local development and the same instance can be driven by a Lambda handler.
 */
export function createApp(deps: AppDependencies) {
  const isProduction = deps.config.NODE_ENV === "production";
  const system = new SystemService({ version: deps.version, environment: deps.config.NODE_ENV });
  const requestIds = new WeakMap<Request, string>();

  return createYoga({
    schema: createSchema<GraphQLContext & YogaInitialContext>({ typeDefs, resolvers }),
    graphqlEndpoint: "/graphql",
    landingPage: false,
    graphiql: !isProduction,
    logging: adaptLogger(deps.logger),
    maskedErrors: { maskError: mapError },
    context: ({ request }): GraphQLContext => {
      const requestId = request.headers.get("x-request-id") ?? randomUUID();
      const correlationId = request.headers.get("x-correlation-id");
      requestIds.set(request, requestId);

      const logger = deps.logger.child({
        requestId,
        ...(correlationId ? { correlationId } : {}),
      });

      return {
        db: deps.db,
        logger,
        requestId,
        services: buildServices({
          db: deps.db,
          logger,
          system,
          bus: deps.bus,
          notifications: deps.notifications,
        }),
      };
    },
    plugins: [operationLoggingPlugin(), requestIdHeaderPlugin(requestIds)],
  });
}

/** The parts of a located GraphQL error needed to rebuild it with different content. */
interface LocatedError {
  originalError?: unknown;
  nodes?: readonly ASTNode[];
  source?: Source;
  positions?: readonly number[];
  path?: readonly (string | number)[];
}

/**
 * Domain errors (`AppError`) are returned to the client with a machine-readable `code`.
 * Everything else is masked with Yoga's default handling so internals never leak.
 *
 * The located error is inspected structurally rather than with `instanceof GraphQLError`:
 * test runners and bundlers can load more than one copy of the `graphql` package, and a class
 * identity check would silently mask every domain error in that situation.
 */
function mapError(error: unknown, message: string, isDev?: boolean): Error {
  const located = typeof error === "object" && error !== null ? (error as LocatedError) : undefined;
  const original = located?.originalError ?? error;

  if (original instanceof AppError) {
    return createGraphQLError(original.message, {
      nodes: located?.nodes,
      source: located?.source,
      positions: located?.positions,
      path: located?.path,
      originalError: original,
      extensions: { code: original.code, ...original.extensions },
    });
  }

  return maskError(error, message, isDev);
}

function adaptLogger(logger: Logger): YogaLogger {
  return {
    debug: (...args: unknown[]) => logger.debug(format(...args)),
    info: (...args: unknown[]) => logger.info(format(...args)),
    warn: (...args: unknown[]) => logger.warn(format(...args)),
    error: (...args: unknown[]) => logger.error(format(...args)),
  };
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}

/** Emits one structured log line per operation with its name, duration and error count. */
function operationLoggingPlugin(): Plugin<GraphQLContext> {
  return {
    onExecute({ args }) {
      const startedAt = performance.now();
      const { logger } = args.contextValue;
      const operationName = args.operationName ?? "anonymous";

      return {
        onExecuteDone({ result }) {
          const durationMs = Math.round(performance.now() - startedAt);
          if (isAsyncIterable(result)) {
            logger.info({ operationName, durationMs }, "graphql stream started");
            return;
          }
          const errorCount = result.errors?.length ?? 0;
          const fields = { operationName, durationMs, errorCount };
          if (errorCount > 0) {
            logger.warn(fields, "graphql operation completed with errors");
          } else {
            logger.info(fields, "graphql operation completed");
          }
        },
      };
    },
  };
}

/** Echoes the request id so clients and log lines can be matched up. */
function requestIdHeaderPlugin(requestIds: WeakMap<Request, string>): Plugin<GraphQLContext> {
  return {
    onResponse({ request, response }) {
      const requestId = requestIds.get(request);
      if (requestId) {
        response.headers.set("x-request-id", requestId);
      }
    },
  };
}
