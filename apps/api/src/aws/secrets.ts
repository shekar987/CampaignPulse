import { GetSecretValueCommand, type SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

export type SecretsReader = Pick<SecretsManagerClient, "send">;

/**
 * Shape of an RDS-managed master user secret. A plain connection string, or a JSON object with
 * a `url` field, is accepted too.
 */
interface RdsSecret {
  url?: string;
  username?: string;
  password?: string;
  host?: string;
  port?: number | string;
  dbname?: string;
  engine?: string;
}

export function connectionStringFromSecret(secretString: string): string {
  const trimmed = secretString.trim();
  if (/^postgres(ql)?:\/\//.test(trimmed)) {
    return trimmed;
  }
  let parsed: RdsSecret;
  try {
    parsed = JSON.parse(trimmed) as RdsSecret;
  } catch {
    throw new Error("Database secret is neither a connection string nor JSON");
  }
  if (parsed.url) {
    return parsed.url;
  }
  const { username, password, host, dbname } = parsed;
  if (!username || !password || !host || !dbname) {
    throw new Error(
      "Database secret JSON must contain url, or username, password, host and dbname",
    );
  }
  const port = parsed.port ?? 5432;
  const user = encodeURIComponent(username);
  const pass = encodeURIComponent(password);
  return `postgresql://${user}:${pass}@${host}:${port}/${dbname}?sslmode=require`;
}

/**
 * Resolves the database connection string for a Lambda: `DATABASE_URL` when set (local runs and
 * tests), otherwise the secret named by `DATABASE_SECRET_ARN`. The value is cached for the
 * lifetime of the execution environment, so warm invocations never call Secrets Manager.
 */
export function createDatabaseUrlResolver(client: () => SecretsReader) {
  let cached: Promise<string> | null = null;
  return (env: NodeJS.ProcessEnv = process.env): Promise<string> => {
    if (env.DATABASE_URL) {
      return Promise.resolve(env.DATABASE_URL);
    }
    if (!cached) {
      const arn = env.DATABASE_SECRET_ARN;
      if (!arn) {
        return Promise.reject(new Error("Set DATABASE_URL or DATABASE_SECRET_ARN"));
      }
      cached = client()
        .send(new GetSecretValueCommand({ SecretId: arn }))
        .then((result) => {
          if (!result.SecretString) {
            throw new Error(`Secret ${arn} has no string value`);
          }
          return connectionStringFromSecret(result.SecretString);
        })
        .catch((error: unknown) => {
          cached = null;
          throw error;
        });
    }
    return cached;
  };
}
