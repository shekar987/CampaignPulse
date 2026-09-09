import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { resolveConnection } from "./ssl";

export type { PrismaClient };

/** Creates a Prisma client backed by the `pg` driver adapter, with TLS resolved explicitly. */
export function createPrismaClient(connectionString: string): PrismaClient {
  const { connectionString: url, ssl } = resolveConnection(connectionString);
  const adapter = new PrismaPg({ connectionString: url, ...(ssl ? { ssl } : {}) });
  return new PrismaClient({ adapter });
}
