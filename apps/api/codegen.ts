import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "src/graphql/schema.graphql",
  generates: {
    "src/graphql/generated/types.ts": {
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        strictScalars: true,
        defaultScalarType: "unknown",
        contextType: "../context#GraphQLContext",
        scalars: {
          DateTime: { input: "Date", output: "Date | string" },
          JSON: { input: "unknown", output: "unknown" },
        },
      },
    },
  },
};

export default config;
