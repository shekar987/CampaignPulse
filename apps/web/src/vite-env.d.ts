/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override the GraphQL endpoint. Defaults to `/graphql`, which Vite proxies to the API. */
  readonly VITE_GRAPHQL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
