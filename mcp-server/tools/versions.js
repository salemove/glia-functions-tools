/**
 * MCP tools for function versions and their environment variables.
 */

import { z } from "zod";
import { makeApiClient, textResult, errorResult, guarded } from "../lib/context.js";

/**
 * Register the version and environment-variable tools.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server - MCP server
 */
export function registerVersionTools(server) {
  server.registerTool(
    "gf_list_function_versions",
    {
      title: "List function versions",
      description: `Lists the versions of a function, newest first by default.

Each version carries its own code and environment variables. Exactly one version
is current (deployed) at a time, and rolling back is just deploying an older
version with gf_deploy_version.

Versions accumulate quickly, so use perPage and order to keep the result small.`,
      inputSchema: {
        functionId: z.string().describe("The Glia Function ID."),
        perPage: z.number().optional().describe("Versions per page (1-100)."),
        order: z.enum(["asc", "desc"]).optional().describe("Sort direction (default desc)."),
        orderBy: z.string().optional().describe("Field to sort by, e.g. created_at.")
      }
    },
    guarded("Error listing versions", async ({ functionId, perPage, order, orderBy }) => {
      const { api } = await makeApiClient();
      return textResult(await api.listVersions(functionId, { perPage, order, orderBy }));
    })
  );

  server.registerTool(
    "gf_create_version",
    {
      title: "Create a function version",
      description: `Uploads code as a new function version. This does not deploy it.

Version creation is asynchronous: this returns a task, whose id you poll with
gf_get_version_task until status is "completed". The completed task carries the
new version id, which you then pass to gf_deploy_version.

The code must be a complete ES module exporting onInvoke, bundled if it has
imports, and at most 512,000 bytes. Run it past gf_validate_code first.
Environment variables are capped at 4,000 bytes in total.`,
      inputSchema: {
        functionId: z.string().describe("The Glia Function ID."),
        code: z.string().describe("Complete bundled ES module source exporting onInvoke."),
        compatibilityDate: z
          .string()
          .optional()
          .describe("Runtime compatibility date, YYYY-MM-DD. Omit for the latest."),
        environmentVariables: z
          .record(z.string(), z.string())
          .optional()
          .describe('Environment variables for this version, for example {"API_KEY":"..."}.'),
        environmentVariablesJson: z
          .string()
          .optional()
          .describe("Deprecated: use environmentVariables. Env vars as a JSON object string.")
      }
    },
    guarded("Error creating version", async ({ functionId, code, compatibilityDate, environmentVariables, environmentVariablesJson }) => {
      const { api } = await makeApiClient();
      const options = {};
      if (compatibilityDate) options.compatibilityDate = compatibilityDate;

      if (environmentVariables) {
        options.environmentVariables = environmentVariables;
      } else if (environmentVariablesJson) {
        // Retained because agent configurations were written against the
        // string-only form, which existed to dodge an MCP Inspector crash on
        // z.record that SDK 1.30 no longer has.
        try {
          options.environmentVariables = JSON.parse(environmentVariablesJson);
        } catch (error) {
          return errorResult("environmentVariablesJson must be valid JSON", error);
        }
      }

      return textResult(await api.createVersion(functionId, code, options));
    })
  );

  server.registerTool(
    "gf_get_version_task",
    {
      title: "Get version creation task status",
      description: `Polls the asynchronous task returned by gf_create_version.

status is "processing", "completed" or "failed". On completion the task carries
the new version, whose id gf_deploy_version needs. On failure the task explains
why, which is usually a bundling or syntax problem in the submitted code.

Creation normally takes a few seconds; poll rather than waiting a fixed time.`,
      inputSchema: {
        functionId: z.string().describe("The Glia Function ID."),
        taskId: z.string().describe("The task id returned by gf_create_version.")
      }
    },
    guarded("Error getting version task", async ({ functionId, taskId }) => {
      const { api } = await makeApiClient();
      return textResult(await api.getVersionCreationTask(functionId, taskId));
    })
  );

  server.registerTool(
    "gf_deploy_version",
    {
      title: "Deploy a function version",
      description: `Makes a version the function's current version. This is the deploy step.

Takes effect immediately for every subsequent invocation. Deploying an older
version is how you roll back; nothing is lost, because versions are immutable.

The version must exist and its creation task must have completed.`,
      inputSchema: {
        functionId: z.string().describe("The Glia Function ID."),
        versionId: z.string().describe("The version ID to make current.")
      }
    },
    guarded("Error deploying version", async ({ functionId, versionId }) => {
      const { api } = await makeApiClient();
      return textResult(await api.deployVersion(functionId, versionId));
    })
  );

  server.registerTool(
    "gf_list_env_vars",
    {
      title: "List function environment variables",
      description: `Lists the environment variables of a function's current deployed version.

Values may come back masked as ******** - the API does not return secrets. Treat
this as a way to see which keys exist, not what they hold.

Errors if the function has no deployed version, since environment variables
belong to a version rather than to the function.`,
      inputSchema: {
        functionId: z.string().describe("The Glia Function ID.")
      }
    },
    guarded("Error listing environment variables", async ({ functionId }) => {
      const { listEnvVars } = await import("../../src/commands/updateEnvVars.js");
      const result = await listEnvVars({ id: functionId });
      return textResult({
        functionId: result.functionId,
        functionName: result.functionName,
        versionId: result.versionId,
        environmentVariables: result.environmentVariables
      });
    })
  );

  server.registerTool(
    "gf_update_env_vars",
    {
      title: "Update function environment variables",
      description: `Changes a function's environment variables by creating a new version.

Environment variables belong to a version, not to a function, so there is no way
to change them in place. This copies the current deployed version, applies the
changes, and deploys the result unless deploy is false.

Set a value to null to delete that variable. Total size is capped at 4,000 bytes.

Examples:
  { functionId: "abc", environmentVariables: { "API_KEY": "secret", "DEBUG": "true" } }
  { functionId: "abc", environmentVariables: { "OLD_VAR": null } }
  { functionId: "abc", environmentVariables: { ... }, deploy: false }`,
      inputSchema: {
        functionId: z.string().describe("The Glia Function ID."),
        environmentVariables: z
          .record(z.string(), z.union([z.string(), z.null()]))
          .describe("Key-value pairs to set. A null value deletes that variable."),
        deploy: z
          .boolean()
          .optional()
          .describe("Deploy the new version immediately (default true).")
      }
    },
    guarded("Error updating environment variables", async ({ functionId, environmentVariables, deploy = true }) => {
      const { updateEnvVars } = await import("../../src/commands/updateEnvVars.js");
      const result = await updateEnvVars({
        id: functionId,
        env: environmentVariables,
        deploy
      });

      return textResult({
        message: result.deployed
          ? "Environment variables updated and deployed"
          : "Environment variables updated but not deployed",
        functionId: result.functionId,
        functionName: result.functionName,
        oldVersionId: result.oldVersionId,
        newVersionId: result.newVersionId,
        deployed: result.deployed
      });
    })
  );
}
