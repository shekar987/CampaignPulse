import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../api/src/graphql/schema.graphql",
  documents: ["src/**/*.{ts,tsx}", "!src/gql/**"],
  ignoreNoDocuments: true,
  generates: {
    "./src/gql/": {
      preset: "client",
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        documentMode: "string",
        useTypeImports: true,
        enumsAsTypes: true,
        strictScalars: true,
        scalars: {
          DateTime: "string",
          JSON: "unknown",
        },
      },
    },
  },
};

export default config;
