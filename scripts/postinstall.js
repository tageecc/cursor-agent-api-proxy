#!/usr/bin/env node

const isGlobal = (process.env.npm_config_global === "true") ||
  (process.env.npm_config_local_prefix !== process.env.npm_config_prefix);

if (!isGlobal) process.exit(0);

console.log(`
  cursor-agent-api-proxy installed.

  Quick start:
    cursor-agent-api            # start the server
    cursor-agent-api install    # register as auto-start service
    cursor-agent-api --help     # usage
`);
