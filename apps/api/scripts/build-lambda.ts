import { build } from "esbuild";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * Bundles each Lambda handler into a single ESM file under
 * infrastructure/serverless/.build/<function>/index.mjs. The generated Prisma client embeds its
 * query compiler as a base64 module loaded by dynamic import, so bundling needs no extra assets.
 */
const apiRoot = fileURLToPath(new URL("../", import.meta.url));
const outRoot = fileURLToPath(
  new URL("../../../infrastructure/serverless/.build/", import.meta.url),
);

const HANDLERS = {
  graphql: "src/lambda/graphql.ts",
  "delivery-worker": "src/lambda/delivery-worker.ts",
  "dead-letter-consumer": "src/lambda/dead-letter-consumer.ts",
} as const;

await rm(outRoot, { recursive: true, force: true });
await mkdir(outRoot, { recursive: true });

for (const [name, entry] of Object.entries(HANDLERS)) {
  const outdir = `${outRoot}${name}/`;
  await mkdir(outdir, { recursive: true });
  const result = await build({
    absWorkingDir: apiRoot,
    entryPoints: [entry],
    outfile: `${outdir}index.mjs`,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    sourcemap: "linked",
    minify: false,
    treeShaking: true,
    // pg optionally loads a native binding; Lambda never has it.
    external: ["pg-native"],
    // Some CommonJS dependencies call require(); provide it in the ESM bundle.
    banner: {
      js: [
        'import { createRequire as __createRequire } from "node:module";',
        "const require = __createRequire(import.meta.url);",
      ].join("\n"),
    },
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "info",
    metafile: true,
  });
  await writeFile(`${outdir}meta.json`, JSON.stringify(result.metafile));
  // The RDS certificate bundle is read next to the module at runtime (see src/db/ssl.ts).
  await copyFile(`${apiRoot}src/db/rds-global-bundle.pem`, `${outdir}rds-global-bundle.pem`);
  const bytes = Object.values(result.metafile.outputs).reduce(
    (sum, output) => sum + output.bytes,
    0,
  );
  console.log(`bundled ${name}: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
}
