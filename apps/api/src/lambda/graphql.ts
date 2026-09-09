import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

import { toRequest, toResult } from "./http";
import { getRuntime } from "./runtime";

/**
 * GraphQL API behind API Gateway (HTTP API). The same Yoga application that serves local
 * development answers here; only the transport adapter differs.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const { app } = await getRuntime();
  const response = await app.fetch(toRequest(event), {});
  return toResult(response);
}
