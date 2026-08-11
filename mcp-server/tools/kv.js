/**
 * MCP tools for the Functions KV Store.
 */

import { z } from "zod";
import {
  makeApiClient,
  textResult,
  guarded,
  checkDestructiveGate,
  destructiveArgs
} from "../lib/context.js";

/** Shared preamble, since the 72-hour TTL is the trap everyone falls into. */
const KV_NOTE = `The KV Store is scoped by namespace. A function's default namespace is its own
function id; a custom namespace lets several functions share data. Namespaces
must be alphanumeric plus _ and -, at most 128 bytes.

Every item expires 72 hours after it is written. This is a cache, not durable
storage: never keep anything here that cannot be recomputed.`;

/**
 * Register the KV Store tools.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server - MCP server
 */
export function registerKvTools(server) {
  server.registerTool(
    "gf_kv_list",
    {
      title: "List KV pairs in a namespace",
      description: `Lists the key-value pairs in a namespace.

${KV_NOTE}

Each item includes its expiry, so you can see how much of the 72 hours is left.`,
      inputSchema: {
        namespace: z.string().describe("Namespace to list. Usually a function id."),
        prefix: z.string().optional().describe("Only return keys starting with this prefix."),
        limit: z.number().optional().describe("Maximum items to return.")
      }
    },
    guarded("Error listing KV pairs", async ({ namespace, prefix, limit }) => {
      const { api } = await makeApiClient();
      return textResult(await api.listKvPairs(namespace, { prefix, limit }));
    })
  );

  server.registerTool(
    "gf_kv_get",
    {
      title: "Get a KV value",
      description: `Reads one key from a namespace.

${KV_NOTE}

A missing key and an expired key are indistinguishable here; both simply are not
found.`,
      inputSchema: {
        namespace: z.string().describe("Namespace to read from."),
        key: z.string().describe("Key to read. Alphanumeric plus _ and -, at most 512 bytes.")
      }
    },
    guarded("Error getting KV value", async ({ namespace, key }) => {
      const { api } = await makeApiClient();
      return textResult(await api.getKvValue(namespace, key));
    })
  );

  server.registerTool(
    "gf_kv_set",
    {
      title: "Set a KV value",
      description: `Writes one key in a namespace, overwriting any existing value.

${KV_NOTE}

Keys are at most 512 bytes and values at most 16,000 bytes. Writing resets the
72-hour clock for that item. Use gf_kv_test_and_set instead when the write
depends on the current value.`,
      inputSchema: {
        namespace: z.string().describe("Namespace to write to."),
        key: z.string().describe("Key to write. Alphanumeric plus _ and -, at most 512 bytes."),
        value: z.string().describe("Value to store, at most 16,000 bytes.")
      }
    },
    guarded("Error setting KV value", async ({ namespace, key, value }) => {
      const { api } = await makeApiClient();
      return textResult(await api.setKvValue(namespace, key, value));
    })
  );

  server.registerTool(
    "gf_kv_delete",
    {
      title: "Delete a KV value",
      description: `Deletes one key from a namespace.

Destructive and not reversible. Requires confirm: true, because a running
function may depend on this key.

${KV_NOTE}

If you only want the value gone eventually, note that it expires on its own
within 72 hours.`,
      inputSchema: {
        namespace: z.string().describe("Namespace to delete from."),
        key: z.string().describe("Key to delete."),
        ...destructiveArgs(z)
      }
    },
    guarded("Error deleting KV value", async ({ namespace, key, confirm, dryRun }) => {
      const gate = checkDestructiveGate(
        { confirm, dryRun },
        `deleting key "${key}" from namespace "${namespace}"`
      );
      if (gate) return gate;

      const { api } = await makeApiClient();
      return textResult(await api.deleteKvValue(namespace, key));
    })
  );

  server.registerTool(
    "gf_kv_test_and_set",
    {
      title: "Conditionally set a KV value",
      description: `Sets a key only if its current value matches what you expect.

This is the primitive for safe concurrent updates: read, compute, then write
conditionally, so a competing writer cannot be silently overwritten.

Pass oldValue: null to require that the key does not currently exist, and
newValue: null to delete it. Omitting either is the same as passing null.

${KV_NOTE}

If the current value does not match oldValue the write does not happen and the
result says so; that is an expected outcome, not an error.`,
      inputSchema: {
        namespace: z.string().describe("Namespace to write to."),
        key: z.string().describe("Key to write."),
        oldValue: z
          .union([z.string(), z.null()])
          .optional()
          .describe("Value the key must currently hold. null means it must not exist."),
        newValue: z
          .union([z.string(), z.null()])
          .optional()
          .describe("Value to write. null deletes the key.")
      }
    },
    guarded("Error in KV test-and-set", async ({ namespace, key, oldValue, newValue }) => {
      const { api } = await makeApiClient();

      // undefined and null both mean "absent"; the previous version also
      // accepted the literal string "null" as a sentinel, kept for compatibility
      // with agent configs written against it.
      const resolve = (value) => (value === undefined || value === "null" ? null : value);

      const result = await api.testAndSetKvValue(
        namespace,
        key,
        resolve(oldValue),
        resolve(newValue)
      );

      if (!result || result.value === null) {
        return textResult({
          applied: false,
          reason: "Current value did not match oldValue, so nothing was written."
        });
      }
      return textResult({ applied: true, result });
    })
  );
}
