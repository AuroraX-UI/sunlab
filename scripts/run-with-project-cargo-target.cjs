#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

delete process.env.CARGO_TARGET_DIR;

const [command, ...arguments] = process.argv.slice(2);
if (!command) {
  console.error("Usage: run-with-project-cargo-target.cjs <command> [arguments...]");
  process.exit(1);
}

const workingDirectory = command === "cargo"
  ? resolve(__dirname, "../src-tauri")
  : process.cwd();

const result = spawnSync(command, arguments, {
  stdio: "inherit",
  env: process.env,
  cwd: workingDirectory,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
