import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * Emits the GraphQL SDL as a TypeScript module so the schema travels inside the application
 * bundle. Reading schema.graphql from disk at runtime would break the single-file Lambda build.
 */
const source = fileURLToPath(new URL("../src/graphql/schema.graphql", import.meta.url));
const target = fileURLToPath(new URL("../src/graphql/generated/schema.ts", import.meta.url));

const sdl = await readFile(source, "utf8");
await mkdir(fileURLToPath(new URL("../src/graphql/generated/", import.meta.url)), {
  recursive: true,
});
await writeFile(
  target,
  [
    "/* Generated from schema.graphql by scripts/inline-schema.ts. Do not edit. */",
    `export const typeDefs = ${JSON.stringify(sdl)};`,
    "",
  ].join("\n"),
);
console.log(`Wrote ${target}`);
