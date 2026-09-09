import type { TypedDocumentString } from "../gql/graphql";

export interface ApiIssue {
  path: string;
  message: string;
}

interface GraphQLErrorPayload {
  message: string;
  extensions?: {
    code?: string;
    issues?: ApiIssue[];
  };
}

interface GraphQLResponsePayload<TResult> {
  data?: TResult | null;
  errors?: GraphQLErrorPayload[];
}

/** An error returned by the API or raised while reaching it. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly issues: ApiIssue[] = [],
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetworkError(): boolean {
    return this.code === "NETWORK_ERROR";
  }
}

const endpoint = import.meta.env.VITE_GRAPHQL_URL ?? "/graphql";

/**
 * Executes a typed GraphQL document. Documents are generated as strings by GraphQL Code
 * Generator, so the request needs no GraphQL runtime in the browser.
 */
export async function execute<TResult, TVariables>(
  document: TypedDocumentString<TResult, TVariables>,
  variables?: TVariables,
): Promise<TResult> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/graphql-response+json, application/json",
      },
      body: JSON.stringify({ query: document.toString(), variables }),
    });
  } catch {
    throw new ApiError(
      "Could not reach the CampaignPulse API. Check that it is running and try again.",
      "NETWORK_ERROR",
    );
  }

  let payload: GraphQLResponsePayload<TResult> | null = null;
  try {
    payload = (await response.json()) as GraphQLResponsePayload<TResult>;
  } catch {
    payload = null;
  }

  if (!payload) {
    throw new ApiError(
      `The API returned an unexpected response (HTTP ${response.status}).`,
      "BAD_RESPONSE",
      [],
      response.status,
    );
  }

  const [firstError] = payload.errors ?? [];
  if (firstError) {
    throw new ApiError(
      firstError.message,
      firstError.extensions?.code ?? "UNKNOWN",
      firstError.extensions?.issues ?? [],
      response.status,
    );
  }

  if (payload.data === undefined || payload.data === null) {
    throw new ApiError("The API returned no data.", "BAD_RESPONSE", [], response.status);
  }

  return payload.data;
}

/** Normalises any thrown value into a message safe to show in the UI. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong.";
}
