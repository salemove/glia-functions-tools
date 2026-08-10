#!/usr/bin/env node

/**
 * Glia Functions MCP server.
 *
 * Exposes the CLI's API client as Model Context Protocol tools over stdio. The
 * tools themselves live in ./tools; this file only wires them up and connects
 * the transport.
 *
 * Notes for anyone changing the tool surface:
 * - Tool names are a contract. Agent configurations reference them, so a rename
 *   needs a deprecated alias, and tests/unit/mcp-server/tool-contract.test.js
 *   will fail until the snapshot is updated deliberately.
 * - Descriptions are the only thing a model has to choose between tools. Keep
 *   them specific about when to use the tool and what it returns.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerFunctionTools } from "./tools/functions.js";
import { registerVersionTools } from "./tools/versions.js";
import { registerKvTools } from "./tools/kv.js";
import { registerScheduleTools } from "./tools/schedules.js";
import { registerValidationTools } from "./tools/validation.js";
import { registerAppletTools } from "./tools/applets.js";

/**
 * Build a server with every tool registered.
 *
 * Exported so the contract test can inspect the tool surface without starting a
 * transport.
 *
 * @returns {McpServer} A configured server
 */
export function createServer() {
  const server = new McpServer({
    name: "glia-functions-cli",
    version: "0.2.0"
  });

  registerFunctionTools(server);
  registerVersionTools(server);
  registerKvTools(server);
  registerScheduleTools(server);
  registerValidationTools(server);
  registerAppletTools(server);

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout carries the protocol, so all logging goes to stderr.
  console.error("Glia Functions MCP server connected via stdio");
}

// Only start a transport when run directly, so importing this module for tests
// does not take over stdio.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("MCP server failed to start:", error);
    process.exit(1);
  });
}
