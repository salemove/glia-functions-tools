import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import GliaApiClient from "../lib/api.js";
import { getApiConfig } from "../lib/config.js";
import { parseAndValidateJson } from "../lib/validation.js";
import { AuthenticationError, NetworkError } from "../lib/errors.js";

// Define current MCP protocol version
const CURRENT_PROTOCOL_VERSION = "2025-11-25";
const FALLBACK_PROTOCOL_VERSION = "2025-03-26";

const server = new McpServer({
    name: "glia-functions-cli",
    version: "0.1.0",
});

/**
 * Helper to create an authenticated GliaApiClient
 */
async function makeApiClient() {
    const apiConfig = await getApiConfig(); // same config the CLI uses
    const api = new GliaApiClient(apiConfig);
    return { api, apiConfig };
}

/**
 * Helper to format results for MCP
 */
function textResult(obj) {
    return {
        content: [
            {
                type: "text",
                text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2),
            },
        ],
    };
}

/**
 * 1) List functions
 */
server.registerTool(
    "gf_list_functions",
    {
        title: "List Glia Functions",
        description:
            "Lists all Glia Functions for the currently configured site/profile.",
        inputSchema: z
            .object({
                verbose: z
                    .boolean()
                    .optional()
                    .describe("If true, include raw API response."),
            })
            .optional(),
    },
    async ({ verbose = false } = {}) => {
        const { api } = await makeApiClient();
        try {
            const list = await api.listFunctions();
            if (!list || !Array.isArray(list.functions)) {
                return textResult("No functions found or invalid response.");
            }
            if (verbose) {
                return textResult(list);
            }
            const summary = list.functions.map((f) => ({
                id: f.id,
                name: f.name,
                description: f.description,
                current_version_id: f.current_version?.id ?? null,
            }));
            return textResult(summary);
        } catch (err) {
            if (err instanceof AuthenticationError) {
                return textResult(
                    `Authentication error while listing functions: ${err.message}`
                );
            }
            if (err instanceof NetworkError) {
                return textResult(
                    `Network error while listing functions: ${err.message}`
                );
            }
            return textResult(`Unexpected error: ${err.message}`);
        }
    }
);

/**
 * 2) Get function details
 */
server.registerTool(
    "gf_get_function",
    {
        title: "Get Glia Function details",
        description: "Returns detailed information about a specific function.",
        inputSchema: z.object({
            functionId: z.string().describe("The Glia Function ID."),
        }),
    },
    async ({ functionId }) => {
        const { api } = await makeApiClient();
        const fn = await api.getFunction(functionId);
        return textResult(fn);
    }
);

/**
 * 3) List function versions
 */
server.registerTool(
    "gf_list_function_versions",
    {
        title: "List function versions",
        description:
            "Lists all versions of a Glia Function, including which one is current.",
        inputSchema: z.object({
            functionId: z.string().describe("The Glia Function ID."),
        }),
    },
    async ({ functionId }) => {
        const { api } = await makeApiClient();
        const versions = await api.listVersions(functionId);
        return textResult(versions);
    }
);

/**
 * 4) Deploy a function version
 */
server.registerTool(
    "gf_deploy_version",
    {
        title: "Deploy function version",
        description:
            "Marks an existing function version as the main deployed version.",
        inputSchema: z.object({
            functionId: z.string().describe("The Glia Function ID."),
            versionId: z.string().describe("The function version ID to deploy."),
        }),
    },
    async ({ functionId, versionId }) => {
        const { api } = await makeApiClient();
        const result = await api.deployVersion(functionId, versionId);
        return textResult({
            message: "Function version deployed",
            result,
        });
    }
);

/**
 * 5) Invoke a function
 */
server.registerTool(
    "gf_invoke_function",
    {
        title: "Invoke a Glia Function",
        description:
            "Invokes a Glia Function with an optional JSON payload. Returns the raw response.",
        inputSchema: z.object({
            invocationUri: z
                .string()
                .optional()
                .describe(
                    "Full invocation URI (preferred). If omitted, functionId must be provided and server will look up invocation URI."
                ),
            functionId: z
                .string()
                .optional()
                .describe(
                    "Function ID to look up invocation URI, if invocationUri is not provided."
                ),
            payloadJson: z
                .string()
                .optional()
                .describe("JSON string payload to send to the function."),
        }),
    },
    async ({ invocationUri, functionId, payloadJson }) => {
        const { api } = await makeApiClient();

        // Resolve invocation URI if only functionId provided
        let uri = invocationUri;
        if (!uri) {
            if (!functionId) {
                return textResult(
                    "You must provide either invocationUri or functionId."
                );
            }
            const fn = await api.getFunction(functionId);
            if (!fn.invocation_uri) {
                return textResult(
                    `Function ${functionId} does not have an invocation_uri.`
                );
            }
            uri = fn.invocation_uri;
        }

        let payload = undefined;
        if (payloadJson) {
            try {
                payload = parseAndValidateJson(payloadJson);
            } catch (err) {
                return textResult(`Invalid payload JSON: ${err.message}`);
            }
        }

        const response = await api.invokeFunction(uri, payload);
        return textResult(response);
    }
);

/**
 * 6) Fetch function logs
 */
server.registerTool(
    "gf_fetch_logs",
    {
        title: "Fetch function logs",
        description:
            "Fetches logs for a function. Useful for debugging from an AI agent.",
        inputSchema: z.object({
            functionId: z.string().describe("The Glia Function ID."),
            limit: z
                .number()
                .int()
                .min(1)
                .max(2000)
                .optional()
                .describe("Max log entries per page (default 1000)."),
            startTimeIso: z
                .string()
                .optional()
                .describe("Optional ISO-8601 start time filter."),
            endTimeIso: z
                .string()
                .optional()
                .describe("Optional ISO-8601 end time filter."),
            fetchAll: z
                .boolean()
                .optional()
                .describe(
                    "If true, follow pagination until all logs are fetched (may be slow)."
                ),
        }),
    },
    async ({ functionId, limit = 1000, startTimeIso, endTimeIso, fetchAll }) => {
        const { fetchLogs } = await import("../commands/fetchLogs.js");

        const options = {
            functionId,
            logsOptions: {
                limit,
                startTime: startTimeIso || null,
                endTime: endTimeIso || null,
            },
            fetchAll: !!fetchAll,
            command: {
                info: () => { }, // Silence info logs
            },
        };

        const logs = await fetchLogs(options);
        return textResult(logs);
    }
);

/**
 * 7) KV Store: List
 */
server.registerTool(
    "gf_kv_list",
    {
        title: "List KV pairs",
        description: "Lists key-value pairs in a specific KV store namespace.",
        inputSchema: z.object({
            namespace: z.string().describe("The KV store namespace."),
            limit: z.number().optional().describe("Max items to return."),
            cursor: z.string().optional().describe("Pagination cursor."),
            fetchAll: z.boolean().optional().describe("Fetch all pages."),
        }),
    },
    async ({ namespace, limit, cursor, fetchAll }) => {
        const { api } = await makeApiClient();
        const result = await api.listKvPairs(namespace, { limit, cursor, fetchAll });
        return textResult(result);
    }
);

/**
 * 8) KV Store: Get
 */
server.registerTool(
    "gf_kv_get",
    {
        title: "Get KV value",
        description: "Gets a value from the KV store.",
        inputSchema: z.object({
            namespace: z.string().describe("The KV store namespace."),
            key: z.string().describe("The key to retrieve."),
        }),
    },
    async ({ namespace, key }) => {
        const { api } = await makeApiClient();
        try {
            const result = await api.getKvValue(namespace, key);
            return textResult(result);
        } catch (err) {
            return textResult(`Error getting KV value: ${err.message}`);
        }
    }
);

/**
 * 9) KV Store: Set
 */
server.registerTool(
    "gf_kv_set",
    {
        title: "Set KV value",
        description: "Sets a value in the KV store.",
        inputSchema: z.object({
            namespace: z.string().describe("The KV store namespace."),
            key: z.string().describe("The key to set."),
            value: z.string().describe("The value to set."),
        }),
    },
    async ({ namespace, key, value }) => {
        const { api } = await makeApiClient();
        const result = await api.setKvValue(namespace, key, value);
        return textResult(result);
    }
);

/**
 * 10) KV Store: Delete
 */
server.registerTool(
    "gf_kv_delete",
    {
        title: "Delete KV value",
        description: "Deletes a value from the KV store.",
        inputSchema: z.object({
            namespace: z.string().describe("The KV store namespace."),
            key: z.string().describe("The key to delete."),
        }),
    },
    async ({ namespace, key }) => {
        const { api } = await makeApiClient();
        const result = await api.deleteKvValue(namespace, key);
        return textResult(result);
    }
);

/**
 * 11) Create function
 */
server.registerTool(
    "gf_create_function",
    {
        title: "Create Glia Function",
        description: `Creates a new Glia Function. The function will need a version deployed before it can be invoked.

Example usage:
- Name: "api-integration" (alphanumeric, hyphens, underscores allowed)
- Description: "Integrates with external API"

Returns the created function with its ID and invocation URI.`,
        inputSchema: z.object({
            name: z
                .string()
                .describe(
                    "Function name (alphanumeric, hyphens, underscores allowed)"
                ),
            description: z
                .string()
                .optional()
                .describe("Function description (optional)"),
        }),
    },
    async ({ name, description }) => {
        const { api } = await makeApiClient();
        try {
            const result = await api.createFunction(name, description);
            return textResult({
                message: "Function created successfully",
                function: result,
            });
        } catch (err) {
            return textResult(`Error creating function: ${err.message}`);
        }
    }
);

/**
 * 12) Update function
 */
server.registerTool(
    "gf_update_function",
    {
        title: "Update Glia Function",
        description: `Updates a Glia Function's metadata (name, description, warm instances).

Warm instances keep your function ready to respond without cold starts:
- 0 = cold start (default, most cost-effective)
- 1-10 = number of warm instances to maintain

Example usage:
- Update name: { functionId: "abc123", name: "new-name" }
- Update description: { functionId: "abc123", description: "Updated description" }
- Set warm instances: { functionId: "abc123", warmInstances: 2 }

Returns the updated function details.`,
        inputSchema: z.object({
            functionId: z.string().describe("The Glia Function ID to update."),
            name: z.string().optional().describe("New function name"),
            description: z.string().optional().describe("New function description"),
            warmInstances: z
                .number()
                .int()
                .min(0)
                .max(10)
                .optional()
                .describe(
                    "Number of warm instances (0-10). 0 = cold start, >0 = keep instances warm."
                ),
        }),
    },
    async ({ functionId, name, description, warmInstances }) => {
        const { api } = await makeApiClient();
        try {
            // Build updates object with only provided fields
            const updates = {};
            if (name !== undefined) updates.name = name;
            if (description !== undefined) updates.description = description;
            if (warmInstances !== undefined)
                updates.warm_instances = warmInstances;

            if (Object.keys(updates).length === 0) {
                return textResult(
                    "No updates provided. Specify at least one field to update (name, description, or warmInstances)."
                );
            }

            const result = await api.updateFunction(functionId, updates);
            return textResult({
                message: "Function updated successfully",
                function: result,
            });
        } catch (err) {
            return textResult(`Error updating function: ${err.message}`);
        }
    }
);

/**
 * 13) Delete function
 */
server.registerTool(
    "gf_delete_function",
    {
        title: "Delete Glia Function",
        description: `Permanently deletes a Glia Function and all its versions.

⚠️ WARNING: This action cannot be undone!
- All function versions will be deleted
- All function configurations will be deleted
- Scheduled triggers for this function will stop working

Only use this when you're absolutely sure you want to remove the function permanently.

Returns confirmation of deletion.`,
        inputSchema: z.object({
            functionId: z
                .string()
                .describe("The Glia Function ID to delete permanently."),
        }),
    },
    async ({ functionId }) => {
        const { api } = await makeApiClient();
        try {
            await api.deleteFunction(functionId);
            return textResult({
                message: "Function deleted successfully",
                functionId: functionId,
            });
        } catch (err) {
            return textResult(`Error deleting function: ${err.message}`);
        }
    }
);

/**
 * 14) List environment variables
 */
server.registerTool(
    "gf_list_env_vars",
    {
        title: "List function environment variables",
        description: `Lists environment variables for a function's current deployed version.

Environment variables are secure key-value pairs available to your function at runtime.
Note: For security, values may be masked (shown as ********).

Returns:
- Function ID and name
- Current version ID
- List of environment variable keys (values may be masked)

If the function has no deployed version, an error is returned.`,
        inputSchema: z.object({
            functionId: z
                .string()
                .describe("The Glia Function ID to list environment variables for."),
        }),
    },
    async ({ functionId }) => {
        const { listEnvVars } = await import("../commands/updateEnvVars.js");
        try {
            const result = await listEnvVars({ id: functionId });
            return textResult({
                functionId: result.functionId,
                functionName: result.functionName,
                versionId: result.versionId,
                environmentVariables: result.environmentVariables,
            });
        } catch (err) {
            return textResult(
                `Error listing environment variables: ${err.message}`
            );
        }
    }
);

/**
 * 15) Update environment variables
 */
server.registerTool(
    "gf_update_env_vars",
    {
        title: "Update function environment variables",
        description: `Updates environment variables for a function. This creates a new version and optionally deploys it.

Environment variables are secure key-value pairs available to your function at runtime.

How it works:
1. Creates a new function version based on the current deployed version
2. Updates the environment variables on the new version
3. Optionally deploys the new version (making it active)

To delete a variable, set its value to null.

Example usage:
- Add variables: { functionId: "abc", environmentVariables: { "API_KEY": "secret123", "DEBUG": "true" } }
- Delete variables: { functionId: "abc", environmentVariables: { "OLD_VAR": null } }
- Update without deploying: { functionId: "abc", environmentVariables: {...}, deploy: false }

Returns:
- New version ID
- Deployment status
- Update summary`,
        inputSchema: z.object({
            functionId: z
                .string()
                .describe("The Glia Function ID to update environment variables for."),
            environmentVariables: z
                .record(z.union([z.string(), z.null()]))
                .describe(
                    "Object with environment variable key-value pairs. Set a value to null to delete it."
                ),
            deploy: z
                .boolean()
                .optional()
                .describe(
                    "Whether to deploy the new version immediately (default: true)"
                ),
        }),
    },
    async ({ functionId, environmentVariables, deploy = true }) => {
        const { updateEnvVars } = await import("../commands/updateEnvVars.js");
        try {
            const result = await updateEnvVars({
                id: functionId,
                env: environmentVariables,
                deploy: deploy,
            });

            return textResult({
                message: result.deployed
                    ? "Environment variables updated and deployed successfully"
                    : "Environment variables updated but not deployed",
                functionId: result.functionId,
                functionName: result.functionName,
                oldVersionId: result.oldVersionId,
                newVersionId: result.newVersionId,
                deployed: result.deployed,
            });
        } catch (err) {
            return textResult(
                `Error updating environment variables: ${err.message}`
            );
        }
    }
);

/**
 * 16) Create function version
 */
server.registerTool(
    "gf_create_version",
    {
        title: "Create function version",
        description: `Creates a new version of a function with code and optional configuration.

A function version represents a specific state of your function's code and configuration.
You can create multiple versions and deploy different versions as needed.

The code should be a string containing your JavaScript function that exports an onInvoke handler:

\`\`\`javascript
export async function onInvoke(request, env) {
  const requestJson = await request.json();
  const payload = JSON.parse(requestJson.payload);

  // Your function logic here

  return Response.json({ success: true, data: payload });
}
\`\`\`

Optional configurations:
- Environment variables: Key-value pairs for secrets and config
- Compatibility date: Runtime compatibility version (format: YYYY-MM-DD)

Returns:
- Task ID for tracking version creation
- Task status endpoint for polling

Note: Version creation is asynchronous. Poll the task endpoint to check when it's ready.`,
        inputSchema: z.object({
            functionId: z.string().describe("The Glia Function ID."),
            code: z
                .string()
                .describe(
                    "JavaScript code string with onInvoke export. Should be bundled/minified."
                ),
            environmentVariables: z
                .record(z.string())
                .optional()
                .describe("Optional environment variables as key-value pairs."),
            compatibilityDate: z
                .string()
                .optional()
                .describe(
                    "Optional compatibility date (YYYY-MM-DD format). Defaults to current date."
                ),
        }),
    },
    async ({ functionId, code, environmentVariables, compatibilityDate }) => {
        const { api } = await makeApiClient();
        try {
            const options = {};
            if (environmentVariables)
                options.environmentVariables = environmentVariables;
            if (compatibilityDate) options.compatibilityDate = compatibilityDate;

            const result = await api.createVersion(functionId, code, options);

            return textResult({
                message: "Function version creation started",
                taskId: result.self?.split("/").pop(),
                taskEndpoint: result.self,
                status: result.status,
                note: "Poll the task endpoint to check when version creation is complete",
            });
        } catch (err) {
            return textResult(`Error creating function version: ${err.message}`);
        }
    }
);

/**
 * 17) Get version creation task status
 */
server.registerTool(
    "gf_get_version_task",
    {
        title: "Get version creation task status",
        description: `Gets the status of a version creation task.

After creating a version with gf_create_version, use this to poll for completion.

Status values:
- "pending": Version is being created
- "in_progress": Version creation is in progress
- "completed": Version is ready (contains entity.id with new version ID)
- "failed": Version creation failed

When status is "completed", you can deploy the version using gf_deploy_version.`,
        inputSchema: z.object({
            functionId: z.string().describe("The Glia Function ID."),
            taskId: z.string().describe("The task ID from create version response."),
        }),
    },
    async ({ functionId, taskId }) => {
        const { api } = await makeApiClient();
        try {
            const result = await api.getVersionCreationTask(functionId, taskId);
            return textResult({
                status: result.status,
                versionId: result.entity?.id,
                error: result.error,
                completedAt: result.completed_at,
            });
        } catch (err) {
            return textResult(`Error getting task status: ${err.message}`);
        }
    }
);

/**
 * 18) Create scheduled trigger
 */
server.registerTool(
    "gf_create_schedule",
    {
        title: "Create scheduled function trigger",
        description: `Creates a scheduled trigger to invoke a function automatically on a recurring schedule.

Scheduled triggers use cron expressions to define when the function should run.
All schedules run in UTC timezone.

Cron Expression Format (Amazon EventBridge - 6 fields):
Minutes Hours Day-of-month Month Day-of-week Year

Examples:
- "0 14 ? * 1 *" = Every Monday at 2:00 PM UTC
- "*/5 * * * ? *" = Every 5 minutes
- "0 0 * * ? *" = Daily at midnight UTC
- "0 9 ? * 2-6 *" = Weekdays (Mon-Fri) at 9:00 AM UTC
- "0 0 1 * ? *" = First day of every month at midnight UTC

Common Patterns:
- Every minute: "* * * * ? *"
- Every 15 minutes: "*/15 * * * ? *"
- Every hour: "0 * * * ? *"
- Daily at 3 AM: "0 3 * * ? *"
- Weekly on Sunday: "0 10 ? * 1 *"

Important Rules:
- Use "?" for either day-of-month OR day-of-week (not both)
- All times are in UTC
- Minute precision (no seconds)

Returns:
- Trigger ID
- Schedule pattern
- Enabled status
- Next execution time (if enabled)`,
        inputSchema: z.object({
            functionId: z
                .string()
                .describe("The Glia Function ID to invoke on the schedule."),
            name: z.string().describe("Name for this scheduled trigger (descriptive)."),
            schedulePattern: z
                .string()
                .describe(
                    "Cron expression (6 fields): Minutes Hours Day Month DayOfWeek Year"
                ),
            description: z
                .string()
                .optional()
                .describe("Optional description of what this schedule does."),
            enabled: z
                .boolean()
                .optional()
                .describe("Whether to enable the trigger immediately (default: true)."),
        }),
    },
    async ({ functionId, name, schedulePattern, description, enabled = true }) => {
        const { api } = await makeApiClient();
        const { validateCronExpression, parseCronExpression, getNextExecutionTime } =
            await import("../utils/cron-helper.js");

        try {
            // Validate cron expression
            const validation = validateCronExpression(schedulePattern);
            if (!validation.valid) {
                return textResult({
                    error: "Invalid cron expression",
                    message: validation.error,
                    provided: schedulePattern,
                    hint: "Use format: Minutes Hours Day Month DayOfWeek Year (e.g., '0 14 ? * 1 *')",
                });
            }

            const result = await api.createScheduledTrigger({
                functionId,
                name,
                schedulePattern,
                description,
                enabled,
            });

            // Add human-readable info
            const humanReadable = parseCronExpression(schedulePattern);
            const nextRun = enabled ? getNextExecutionTime(schedulePattern) : null;

            return textResult({
                message: "Scheduled trigger created successfully",
                trigger: {
                    id: result.id,
                    name: result.name,
                    functionId: result.trigger_id,
                    schedulePattern: result.schedule_pattern,
                    description: result.description,
                    enabled: result.enabled,
                    humanReadable: humanReadable,
                    nextExecution: nextRun ? nextRun.toISOString() : "Disabled",
                },
            });
        } catch (err) {
            return textResult(`Error creating scheduled trigger: ${err.message}`);
        }
    }
);

/**
 * 19) List scheduled triggers
 */
server.registerTool(
    "gf_list_schedules",
    {
        title: "List scheduled triggers",
        description: `Lists all scheduled triggers for the current site.

Returns a list of all scheduled function invocations, including:
- Trigger ID and name
- Function ID being invoked
- Cron expression and human-readable description
- Enabled/disabled status
- Next execution time (for enabled triggers)

Useful for:
- Viewing all automated function invocations
- Monitoring scheduled jobs
- Finding triggers to update or delete`,
        inputSchema: z
            .object({
                includeDisabled: z
                    .boolean()
                    .optional()
                    .describe(
                        "Include disabled triggers in the results (default: true)."
                    ),
            })
            .optional(),
    },
    async ({ includeDisabled = true } = {}) => {
        const { api } = await makeApiClient();
        const { parseCronExpression, getNextExecutionTime, formatTimeRemaining } =
            await import("../utils/cron-helper.js");

        try {
            const result = await api.listScheduledTriggers();

            if (!result.items || result.items.length === 0) {
                return textResult({
                    message: "No scheduled triggers found",
                    count: 0,
                    items: [],
                });
            }

            // Filter and enrich triggers
            let triggers = result.items;
            if (!includeDisabled) {
                triggers = triggers.filter((t) => t.enabled);
            }

            const enrichedTriggers = triggers.map((trigger) => {
                const humanReadable = parseCronExpression(trigger.schedule_pattern);
                const nextRun = trigger.enabled
                    ? getNextExecutionTime(trigger.schedule_pattern)
                    : null;
                const timeRemaining = nextRun ? formatTimeRemaining(nextRun) : null;

                return {
                    id: trigger.id,
                    name: trigger.name,
                    functionId: trigger.trigger_id,
                    schedulePattern: trigger.schedule_pattern,
                    humanReadable: humanReadable,
                    description: trigger.description || "",
                    enabled: trigger.enabled,
                    nextExecution: nextRun ? nextRun.toISOString() : "Disabled",
                    timeUntilNext: timeRemaining,
                };
            });

            return textResult({
                message: `Found ${enrichedTriggers.length} scheduled trigger(s)`,
                count: enrichedTriggers.length,
                triggers: enrichedTriggers,
            });
        } catch (err) {
            return textResult(`Error listing scheduled triggers: ${err.message}`);
        }
    }
);

/**
 * 20) Get scheduled trigger details
 */
server.registerTool(
    "gf_get_schedule",
    {
        title: "Get scheduled trigger details",
        description: `Gets detailed information about a specific scheduled trigger.

Returns:
- Trigger ID, name, and description
- Function ID being invoked
- Cron expression with human-readable description
- Enabled/disabled status
- Next execution time (if enabled)
- Time remaining until next execution

Useful for checking the status and configuration of a specific scheduled job.`,
        inputSchema: z.object({
            triggerId: z.string().describe("The scheduled trigger ID to retrieve."),
        }),
    },
    async ({ triggerId }) => {
        const { api } = await makeApiClient();
        const { parseCronExpression, getNextExecutionTime, formatTimeRemaining } =
            await import("../utils/cron-helper.js");

        try {
            const trigger = await api.getScheduledTrigger(triggerId);

            const humanReadable = parseCronExpression(trigger.schedule_pattern);
            const nextRun = trigger.enabled
                ? getNextExecutionTime(trigger.schedule_pattern)
                : null;
            const timeRemaining = nextRun ? formatTimeRemaining(nextRun) : null;

            return textResult({
                trigger: {
                    id: trigger.id,
                    name: trigger.name,
                    functionId: trigger.trigger_id,
                    schedulePattern: trigger.schedule_pattern,
                    humanReadable: humanReadable,
                    description: trigger.description || "",
                    enabled: trigger.enabled,
                    nextExecution: nextRun ? nextRun.toISOString() : "Disabled",
                    timeUntilNext: timeRemaining,
                    createdAt: trigger.created_at,
                    updatedAt: trigger.updated_at,
                },
            });
        } catch (err) {
            return textResult(`Error getting scheduled trigger: ${err.message}`);
        }
    }
);

/**
 * 21) Update scheduled trigger
 */
server.registerTool(
    "gf_update_schedule",
    {
        title: "Update scheduled trigger",
        description: `Updates an existing scheduled trigger's configuration.

You can update any combination of:
- Name: Descriptive name for the trigger
- Description: What this schedule does
- Schedule pattern: New cron expression
- Enabled: Enable or disable the trigger

Examples:
- Change schedule: { triggerId: "abc", schedulePattern: "0 */2 * * ? *" } = Every 2 hours
- Disable trigger: { triggerId: "abc", enabled: false }
- Update description: { triggerId: "abc", description: "Updated description" }
- Change name: { triggerId: "abc", name: "new-name" }

Returns the updated trigger configuration with next execution time.`,
        inputSchema: z.object({
            triggerId: z.string().describe("The scheduled trigger ID to update."),
            name: z.string().optional().describe("New name for the trigger."),
            description: z
                .string()
                .optional()
                .describe("New description for the trigger."),
            schedulePattern: z
                .string()
                .optional()
                .describe("New cron expression (6 fields)."),
            enabled: z
                .boolean()
                .optional()
                .describe("Enable (true) or disable (false) the trigger."),
        }),
    },
    async ({ triggerId, name, description, schedulePattern, enabled }) => {
        const { api } = await makeApiClient();
        const { validateCronExpression, parseCronExpression, getNextExecutionTime } =
            await import("../utils/cron-helper.js");

        try {
            // Validate cron expression if provided
            if (schedulePattern) {
                const validation = validateCronExpression(schedulePattern);
                if (!validation.valid) {
                    return textResult({
                        error: "Invalid cron expression",
                        message: validation.error,
                        provided: schedulePattern,
                        hint: "Use format: Minutes Hours Day Month DayOfWeek Year",
                    });
                }
            }

            // Build updates object
            const updates = {};
            if (name !== undefined) updates.name = name;
            if (description !== undefined) updates.description = description;
            if (schedulePattern !== undefined)
                updates.schedulePattern = schedulePattern;
            if (enabled !== undefined) updates.enabled = enabled;

            if (Object.keys(updates).length === 0) {
                return textResult(
                    "No updates provided. Specify at least one field to update."
                );
            }

            const result = await api.updateScheduledTrigger(triggerId, updates);

            // Add human-readable info
            const humanReadable = parseCronExpression(result.schedule_pattern);
            const nextRun = result.enabled
                ? getNextExecutionTime(result.schedule_pattern)
                : null;

            return textResult({
                message: "Scheduled trigger updated successfully",
                trigger: {
                    id: result.id,
                    name: result.name,
                    functionId: result.trigger_id,
                    schedulePattern: result.schedule_pattern,
                    humanReadable: humanReadable,
                    description: result.description,
                    enabled: result.enabled,
                    nextExecution: nextRun ? nextRun.toISOString() : "Disabled",
                },
            });
        } catch (err) {
            return textResult(`Error updating scheduled trigger: ${err.message}`);
        }
    }
);

/**
 * 22) Delete scheduled trigger
 */
server.registerTool(
    "gf_delete_schedule",
    {
        title: "Delete scheduled trigger",
        description: `Permanently deletes a scheduled trigger.

⚠️ WARNING: This action cannot be undone!
- The function will no longer be invoked automatically
- All schedule configuration will be lost

The function itself is not deleted - only the scheduled invocation is removed.

Use this when you want to stop a recurring function invocation permanently.`,
        inputSchema: z.object({
            triggerId: z
                .string()
                .describe("The scheduled trigger ID to delete permanently."),
        }),
    },
    async ({ triggerId }) => {
        const { api } = await makeApiClient();
        try {
            await api.deleteScheduledTrigger(triggerId);
            return textResult({
                message: "Scheduled trigger deleted successfully",
                triggerId: triggerId,
            });
        } catch (err) {
            return textResult(`Error deleting scheduled trigger: ${err.message}`);
        }
    }
);

/**
 * 23) Validate cron expression
 */
server.registerTool(
    "gf_validate_cron",
    {
        title: "Validate and explain cron expression",
        description: `Validates a cron expression and provides a human-readable explanation.

This is a helper tool for understanding and testing cron expressions before creating schedules.

Cron Format (6 fields):
Minutes Hours Day-of-month Month Day-of-week Year

Returns:
- Validation result (valid/invalid)
- Human-readable description of when it runs
- Next execution time (approximate)
- Error message if invalid

Examples to try:
- "0 14 ? * 1 *" = Every Monday at 2:00 PM UTC
- "*/5 * * * ? *" = Every 5 minutes
- "0 0 1 * ? *" = First day of every month at midnight`,
        inputSchema: z.object({
            cronExpression: z
                .string()
                .describe("The cron expression to validate and explain."),
        }),
    },
    async ({ cronExpression }) => {
        const {
            validateCronExpression,
            parseCronExpression,
            getNextExecutionTime,
            formatTimeRemaining,
            CRON_PRESETS,
        } = await import("../utils/cron-helper.js");

        try {
            const validation = validateCronExpression(cronExpression);

            if (!validation.valid) {
                return textResult({
                    valid: false,
                    error: validation.error,
                    provided: cronExpression,
                    hint: "Format: Minutes Hours Day Month DayOfWeek Year (use ? for day-of-month OR day-of-week)",
                });
            }

            const humanReadable = parseCronExpression(cronExpression);
            const nextRun = getNextExecutionTime(cronExpression);
            const timeRemaining = nextRun ? formatTimeRemaining(nextRun) : null;

            // Check if it matches a preset
            const matchingPreset = Object.entries(CRON_PRESETS).find(
                ([, preset]) => preset.expression === cronExpression
            );

            return textResult({
                valid: true,
                expression: cronExpression,
                humanReadable: humanReadable,
                nextExecution: nextRun ? nextRun.toISOString() : null,
                timeUntilNext: timeRemaining,
                preset: matchingPreset
                    ? {
                          name: matchingPreset[0],
                          description: matchingPreset[1].description,
                      }
                    : null,
            });
        } catch (err) {
            return textResult(`Error validating cron expression: ${err.message}`);
        }
    }
);

/**
 * 24) Get common cron presets
 */
server.registerTool(
    "gf_cron_presets",
    {
        title: "Get common cron expression presets",
        description: `Returns a list of common pre-built cron expressions for typical scheduling needs.

Use these presets as a starting point or for common scheduling patterns.

Returns 12 common patterns including:
- Every minute, 5 minutes, 15 minutes, 30 minutes
- Hourly, daily, weekly schedules
- Business hours patterns
- Month-end schedules

Each preset includes:
- Name/ID
- Cron expression
- Human-readable description
- Example use cases`,
        inputSchema: z.object({}).optional(),
    },
    async () => {
        const { CRON_PRESETS } = await import("../utils/cron-helper.js");

        const presets = Object.entries(CRON_PRESETS).map(([key, preset]) => ({
            id: key,
            expression: preset.expression,
            description: preset.description,
        }));

        return textResult({
            message: "Common cron expression presets",
            count: presets.length,
            presets: presets,
            note: "All schedules run in UTC timezone. Use gf_validate_cron to test expressions.",
        });
    }
);

/**
 * 25) Validate function code
 */
server.registerTool(
    "gf_validate_code",
    {
        title: "Validate Glia Function code",
        description: `Validates JavaScript code before deployment to catch errors early.

This tool performs comprehensive validation including:
- JavaScript syntax validation
- Verification of required onInvoke export
- Detection of common anti-patterns
- Bundle size estimation
- Runtime error checks

Use this before creating a function version to ensure code quality and prevent deployment issues.

Example workflow:
1. Generate or write function code
2. Validate with gf_validate_code
3. Fix any errors or warnings
4. Create version with gf_create_version

Returns detailed validation results including any errors or warnings found.`,
        inputSchema: z.object({
            code: z
                .string()
                .describe(
                    "JavaScript code to validate. Should include onInvoke export."
                ),
            strict: z
                .boolean()
                .optional()
                .describe(
                    "Enable strict validation mode (treats some warnings as errors). Default: false"
                ),
        }),
    },
    async ({ code, strict = false }) => {
        const { validateCode } = await import("../utils/code-validator.js");

        try {
            const result = await validateCode(code, { strict });

            // Format the result for better readability
            const summary = {
                valid: result.valid,
                hasOnInvoke: result.hasOnInvoke,
                estimatedBundleSize: formatBytes(result.estimatedSize),
                errorCount: result.errors.length,
                warningCount: result.warnings.length,
            };

            // Organize errors by severity
            const criticalErrors = result.errors.filter(
                (e) => e.severity === "error"
            );
            const warnings = [
                ...result.errors.filter((e) => e.severity === "warning"),
                ...result.warnings.map((w) => ({
                    message: w,
                    severity: "warning",
                })),
            ];

            return textResult({
                summary,
                status: result.valid ? "✅ Code is valid" : "❌ Validation failed",
                errors: criticalErrors.length > 0 ? criticalErrors : undefined,
                warnings: warnings.length > 0 ? warnings : undefined,
                recommendations:
                    result.valid
                        ? [
                              "Code passed validation",
                              "Ready to create function version",
                              warnings.length > 0
                                  ? `Consider addressing ${warnings.length} warning(s) for better code quality`
                                  : "No warnings found",
                          ]
                        : [
                              "Fix all errors before deployment",
                              "Run validation again after fixes",
                              "Use strict mode for stricter validation",
                          ],
            });
        } catch (err) {
            return textResult({
                error: `Validation failed: ${err.message}`,
                details: err.stack,
            });
        }

        // Helper function to format bytes
        function formatBytes(bytes) {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        }
    }
);

async function main() {
    // Use stdio transport only
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP server connected via stdio transport');
}

main().catch((err) => {
    console.error("MCP server failed to start:", err);
    process.exit(1);
});