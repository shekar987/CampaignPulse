import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

/** Converts an API Gateway HTTP API (payload v2) event into a Fetch API Request. */
export function toRequest(event: APIGatewayProxyEventV2): Request {
  const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const url = `https://${event.requestContext.domainName}${event.rawPath}${query}`;
  const method = event.requestContext.http.method;
  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) {
      headers.set(name, value);
    }
  }
  const hasBody = method !== "GET" && method !== "HEAD" && event.body !== undefined;
  const body = hasBody
    ? event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64")
      : event.body
    : undefined;
  return new Request(url, { method, headers, body });
}

/** Converts a Fetch API Response into an API Gateway HTTP API (payload v2) result. */
export async function toResult(response: Response): Promise<APIGatewayProxyResultV2> {
  const headers: Record<string, string> = {};
  const cookies: string[] = [];
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie") {
      cookies.push(value);
    } else {
      headers[name] = value;
    }
  });
  return {
    statusCode: response.status,
    headers,
    ...(cookies.length > 0 ? { cookies } : {}),
    body: await response.text(),
    isBase64Encoded: false,
  };
}
