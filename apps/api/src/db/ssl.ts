import { readFileSync } from "node:fs";

export interface SslOptions {
  rejectUnauthorized: boolean;
  ca?: string;
}

export interface ResolvedConnection {
  /** The connection string with the TLS parameters removed; TLS is configured separately. */
  connectionString: string;
  ssl: SslOptions | undefined;
}

const SSL_PARAMS = ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"];

/**
 * Amazon RDS certificates chain to Amazon's own root CAs, which Node does not trust by default.
 * The RDS global bundle ships next to this module (and next to each Lambda bundle), so
 * `sslmode=require` verifies the server certificate against it instead of failing.
 */
export function loadBundledRdsCa(): string | undefined {
  try {
    return readFileSync(new URL("./rds-global-bundle.pem", import.meta.url), "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Splits TLS settings out of a PostgreSQL connection string. The `pg` driver lets values parsed
 * from the string override explicit options, so the string must not carry `sslmode` when the
 * TLS configuration is supplied programmatically.
 *
 * - no `sslmode`, or `disable`: plain connection (local development).
 * - `no-verify`: encrypted, certificate not checked.
 * - anything else (`require`, `verify-ca`, `verify-full`, `prefer`): encrypted and verified
 *   against `DATABASE_SSL_CA` (PEM text), `sslrootcert=<file>`, or the bundled RDS bundle.
 */
export function resolveConnection(
  connectionString: string,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedConnection {
  const url = new URL(connectionString);
  const mode = url.searchParams.get("sslmode");
  const rootCert = url.searchParams.get("sslrootcert");
  for (const param of SSL_PARAMS) {
    url.searchParams.delete(param);
  }
  const stripped = url.toString();

  if (!mode || mode === "disable") {
    return { connectionString: stripped, ssl: undefined };
  }
  if (mode === "no-verify") {
    return { connectionString: stripped, ssl: { rejectUnauthorized: false } };
  }

  const ca =
    env.DATABASE_SSL_CA || (rootCert ? readFileSync(rootCert, "utf8") : loadBundledRdsCa());
  return {
    connectionString: stripped,
    ssl: ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true },
  };
}
