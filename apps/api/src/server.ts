import "dotenv/config";

import { createServer } from "node:http";

import packageJson from "../package.json" with { type: "json" };
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createPrismaClient } from "./db/client";
import { createLogger } from "./logging/logger";

const config = loadConfig();
const logger = createLogger({
  level: config.LOG_LEVEL,
  pretty: config.NODE_ENV === "development",
});
const db = createPrismaClient(config.DATABASE_URL);

try {
  await db.$connect();
} catch (error) {
  logger.fatal(
    { err: error },
    "Cannot connect to PostgreSQL. Is the database running? Try `npm run db:up` from the repository root.",
  );
  process.exit(1);
}

const app = createApp({ db, logger, config, version: packageJson.version });
const server = createServer(app);

server.listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, url: `http://localhost:${config.PORT}${app.graphqlEndpoint}` },
    "api listening",
  );
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, "shutting down");
  server.close();
  await db.$disconnect();
  process.exit(0);
}

process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));
