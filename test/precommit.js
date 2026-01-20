#!/usr/bin/env node

/**
 * Precommit hook - runs lint, cpd, and tests
 */

import { spawnSync } from "node:child_process";
import { dirname } from "node:path";

const rootDir = dirname(import.meta.dirname);

const steps = [
  { name: "lint:fix", cmd: "bun", args: ["run", "lint:fix"] },
  { name: "cpd", cmd: "bun", args: ["run", "cpd"] },
  { name: "test", cmd: "bun", args: ["test"] },
];

const verbose = process.argv.includes("--verbose");

console.log(
  verbose
    ? "Running precommit checks (verbose)...\n"
    : "Running precommit checks...",
);

const results = {};

for (const step of steps) {
  const result = spawnSync(step.cmd, step.args, {
    cwd: rootDir,
    stdio: verbose ? "inherit" : ["inherit", "pipe", "pipe"],
  });

  results[step.name] = { status: result.status };

  if (result.status !== 0) {
    console.log(`\n❌ ${step.name} failed`);
    if (!verbose && result.stderr) {
      console.log(result.stderr.toString());
    }
    if (!verbose && result.stdout) {
      console.log(result.stdout.toString());
    }
    process.exit(1);
  }

  console.log(`✅ ${step.name} passed`);
}

console.log(`\n${"=".repeat(40)}`);
console.log("PRECOMMIT SUMMARY");
console.log("=".repeat(40));
console.log(`✅ All checks passed: ${steps.map((s) => s.name).join(", ")}`);
console.log("=".repeat(40));
