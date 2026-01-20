/**
 * Build script for Bunny Edge deployment
 * Bundles edge script into a single deployable file
 */

const result = await Bun.build({
  entrypoints: ["./src/edge/bunny-script.ts"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  minify: false,
  external: [
    "https://esm.sh/@bunny.net/edgescript-sdk@0.10.0",
    "https://esm.sh/@libsql/client@0.6.0/web",
    "https://esm.sh/node-html-parser@6.1.13",
  ],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

const outputPath = result.outputs[0]?.path;
if (!outputPath) {
  console.error("No output file generated");
  process.exit(1);
}

const content = await Bun.file(outputPath).text();

const finalContent = content
  .replace(
    /from\s+["']\.\.\/lib\/constants\.ts["']/g,
    'from "./lib/constants.ts"',
  )
  .replace(
    /from\s+["']node-html-parser["']/g,
    'from "https://esm.sh/node-html-parser@6.1.13"',
  );

await Bun.write("./bunny-script.ts", finalContent);

console.log("Build complete: bunny-script.ts");

export {};
