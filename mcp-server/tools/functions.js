/**
 * MCP tools for the function lifecycle: listing, reading, creating, updating,
 * deleting, invoking and reading logs.
 */

import { z } from "zod";
import { fetchLogs } from "../../src/commands/fetchLogs.js";
import {
  makeApiClient,
  textResult,
  errorResult,
  guarded,
  checkDestructiveGate,
  destructiveArgs
} from "../lib/context.js";

/**
 * Register the function-management tools.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server - MCP server
 */
export function registerFunctionTools(server) {
  server.registerTool(
    "gf_list_functions",
    {
      title: "List Glia Functions",
      description: `Lists every Glia Function on the configured site.

Returns each function's id, name, description and invocation_uri. The id is what
every other function tool takes as functionId; the invocation_uri is what
gf_invoke_function calls.

A site is limited to 30 functions, so this list is short and cheap to fetch.
Start here when you do not already know a function's id.`,
      inputSchema: {
        verbose: z
          .boolean()
          .optional()
          .describe("If true, return the raw API response instead of just the functions array.")
      }
    },
    guarded("Error listing functions", async ({ verbose } = {}) => {
      const { api } = await makeApiClient();
      const list = await api.listFunctions();
      return textResult(verbose ? list : list?.functions || []);
    })
  );

  server.registerTool(
    "gf_get_function",
    {
      title: "Get function details",
      description: `Gets full details for one function, including its current deployed version.

Returns id, name, description, site_id, invocation_uri and current_version. Use
current_version.id when you need the version a request would actually run, for
example before reading or changing environment variables.

If current_version is absent the function has code but nothing deployed, and
invoking it will fail.`,
      inputSchema: {
        functionId: z.string().describe("The Glia Function ID.")
      }
    },
    guarded("Error getting function", async ({ functionId }) => {
      const { api } = await makeApiClient();
      return textResult(await api.getFunction(functionId));
    })
  );

  server.registerTool(
    "gf_create_function",
    {
      title: "Create a function",
      description: `Creates a new function entity. This does not create any code.

Deploying a working function takes three steps:
  1. gf_create_function        -> returns a functionId and invocation_uri
  2. gf_create_version         -> uploads code, returns a task to poll
  3. gf_deploy_version         -> makes that version current

A site is limited to 30 functions, so prefer creating a new version of an
existing function over creating another function.`,
      inputSchema: {
        name: z.string().describe("Function name, shown in Glia Hub."),
        description: z.string().optional().describe("What the function is for."),
        warmInstances: z
          .number()
          .optional()
          .describe("Instances kept warm to avoid cold starts. Omit for the site default.")
      }
    },
    guarded("Error creating function", async ({ name, description, warmInstances }) => {
      const { api } = await makeApiClient();
      const options = warmInstances !== undefined ? { warmInstances } : {};
      return textResult(await api.createFunction(name, description || "", options));
    })
  );

  server.registerTool(
    "gf_update_function",
    {
      title: "Update a function's metadata",
      description: `Updates a function's name, description or warm-instance count.

This changes metadata only. It does not touch code or environment variables: use
gf_create_version for code and gf_update_env_vars for environment variables.`,
      inputSchema: {
        functionId: z.string().describe("The Glia Function ID."),
        name: z.string().optional().describe("New name."),
        description: z.string().optional().describe("New description."),
        warmInstances: z.number().optional().describe("New warm-instance count.")
      }
    },
    guarded("Error updating function", async ({ functionId, name, description, warmInstances }) => {
      const { api } = await makeApiClient();
      const updates = {};
      if (name) updates.name = name;
      if (description) updates.description = description;
      if (warmInstances !== undefined) updates.warmInstances = warmInstances;
      return textResult(await api.updateFunction(functionId, updates));
    })
  );

  server.registerTool(
    "gf_delete_function",
    {
      title: "Delete a function",
      description: `Permanently deletes a function and all of its versions.

Destructive and not reversible. Requires confirm: true. Anything invoking the
function's invocation_uri - an Export, an Applet, a scheduled trigger - will
start failing. Delete the scheduled triggers that point at it first
(gf_list_scheduled_triggers, gf_delete_scheduled_trigger).

Pass dryRun: true to see what would happen without changing anything.`,
      inputSchema: {
        functionId: z.string().describe("The Glia Function ID to delete."),
        ...destructiveArgs(z)
      }
    },
    guarded("Error deleting function", async ({ functionId, confirm, dryRun }) => {
      const gate = checkDestructiveGate(
        { confirm, dryRun },
        `deleting function ${functionId} and all of its versions`
      );
      if (gate) return gate;

      const { api } = await makeApiClient();
      await api.deleteFunction(functionId);
      return textResult({ success: true, deleted: "function", functionId });
    })
  );

  server.registerTool(
    "gf_invoke_function",
    {
      title: "Invoke a function",
      description: `Invokes a deployed function and returns its response.

Give either invocationUri (from gf_get_function or gf_list_functions) or
functionId, in which case the invocation_uri is looked up first. The payload is
passed as a JSON string so that any JSON shape can be sent.

The function must have a deployed current version. Execution is capped at 20
seconds. Anything the function logs with console.log is readable afterwards with
gf_fetch_logs.`,
      inputSchema: {
        invocationUri: z
          .string()
          .optional()
          .describe("The function's invocation URI. Preferred, as it needs no lookup."),
        functionId: z
          .string()
          .optional()
          .describe("Function ID, used to look up the invocation URI."),
        payloadJson: z
          .string()
          .optional()
          .describe('Request payload as a JSON string, for example {"key":"value"}.')
      }
    },
    guarded("Error invoking function", async ({ invocationUri, functionId, payloadJson }) => {
      const { api } = await makeApiClient();

      let uri = invocationUri;
      if (!uri) {
        if (!functionId) {
          return errorResult("Provide either invocationUri or functionId.");
        }
        const fn = await api.getFunction(functionId);
        uri = fn.invocation_uri;
      }

      let payload;
      if (payloadJson) {
        try {
          payload = JSON.parse(payloadJson);
        } catch (error) {
          return errorResult("payloadJson must be valid JSON", error);
        }
      }

      return textResult(await api.invokeFunction(uri, payload));
    })
  );

  server.registerTool(
    "gf_fetch_logs",
    {
      title: "Fetch function logs",
      description: `Fetches the runtime logs a function produced with console.log.

Logs are retained for 72 hours, so a time range outside that window returns
nothing. Narrow the range with startTimeIso/endTimeIso when debugging a specific
invocation; set fetchAll to page through everything in the range.

This is the primary way to see why an invocation failed, since gf_invoke_function
only returns the response the function produced.`,
      inputSchema: {
        functionId: z.string().describe("The Glia Function ID."),
        limit: z.number().optional().describe("Maximum log entries to return (default 1000)."),
        startTimeIso: z.string().optional().describe("Start of the range, ISO 8601."),
        endTimeIso: z.string().optional().describe("End of the range, ISO 8601."),
        fetchAll: z.boolean().optional().describe("If true, follow pagination to the end of the range.")
      }
    },
    guarded("Error fetching logs", async ({ functionId, limit, startTimeIso, endTimeIso, fetchAll }) => {
      const logs = await fetchLogs({
        functionId,
        logsOptions: { limit: limit || 1000, startTime: startTimeIso, endTime: endTimeIso },
        fetchAll: !!fetchAll,
        command: { info: () => {} }
      });
      return textResult(logs);
    })
  );
}
