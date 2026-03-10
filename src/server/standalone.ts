#!/usr/bin/env node
/**
 * Standalone entry point.
 *
 * Usage:
 *   cursor-agent-api [port]
 *   node dist/server/standalone.js [port]
 */

import { startServer, stopServer } from "./index.js";
import { setCachedCliVersion } from "./routes.js";
import { verifyCursorCli } from "../subprocess/manager.js";

const DEFAULT_PORT = 4646;

async function main(): Promise<void> {
  console.log("Cursor Agent API Proxy");
  console.log("======================\n");

  const portStr = process.argv[2] || process.env.PORT || String(DEFAULT_PORT);
  const port = parseInt(portStr, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${portStr}`);
    process.exit(1);
  }

  console.log("Checking Cursor CLI (agent)...");
  const check = await verifyCursorCli();
  if (check.ok) {
    console.log(`  Cursor CLI: ${check.version || "OK"}`);
    if (check.version) setCachedCliVersion(check.version);
  } else {
    console.error(`  ${check.error}`);
    console.error("\nPlease install and authenticate the Cursor CLI first:");
    if (process.platform === "win32") {
      console.error("  irm 'https://cursor.com/install?win32=true' | iex");
      console.error("  set CURSOR_API_KEY=your_key_here");
    } else {
      console.error("  curl https://cursor.com/install -fsS | bash");
      console.error("  export CURSOR_API_KEY=your_key_here");
    }
    process.exit(1);
  }

  try {
    await startServer({ port });

    console.log("\nExamples:\n");
    console.log("  # Health check");
    console.log(`  curl http://localhost:${port}/health\n`);
    console.log("  # List models");
    console.log(`  curl http://localhost:${port}/v1/models\n`);
    console.log("  # Chat completion");
    console.log(`  curl -X POST http://localhost:${port}/v1/chat/completions \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(
      `    -d '{"model":"cursor/auto","messages":[{"role":"user","content":"Hello!"}]}'\n`
    );
    console.log("  # Streaming");
    console.log(`  curl -N -X POST http://localhost:${port}/v1/chat/completions \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(
      `    -d '{"model":"cursor/auto","messages":[{"role":"user","content":"Hello!"}],"stream":true}'\n`
    );
    console.log("Press Ctrl+C to stop.\n");
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }

  const shutdown = async () => {
    console.log("\nShutting down...");
    await stopServer();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
