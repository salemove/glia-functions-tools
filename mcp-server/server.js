import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Define current MCP protocol version
const CURRENT_PROTOCOL_VERSION = "2025-11-25";
const FALLBACK_PROTOCOL_VERSION = "2025-03-26";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the path to the main project directory
const projectDir = path.resolve(__dirname, '..');

// Create server instance with explicit protocol version
const server = new McpServer({
    name: "glia-functions-cli",
    version: "0.1.0",
    protocolVersion: CURRENT_PROTOCOL_VERSION,
});

/**
 * Dynamic import helper - imports modules from the main project
 */
async function importFromProject(modulePath) {
    const fullPath = path.join(projectDir, modulePath);
    return import(fullPath);
}

/**
 * Helper to create an authenticated GliaApiClient
 */
async function makeApiClient() {
    const { default: GliaApiClient } = await importFromProject('src/lib/api.js');
    const { getApiConfig } = await importFromProject('src/lib/config.js');

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
server.tool(
    "gf_list_functions",
    "Lists all Glia Functions for the currently configured site/profile.",
    {
        verbose: z
            .boolean()
            .optional()
            .describe("If true, include raw API response."),
    },
    async ({ verbose }) => {
        const { api } = await makeApiClient();
        const { AuthenticationError, NetworkError } = await importFromProject('src/lib/errors.js');

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
server.tool(
    "gf_get_function",
    "Returns detailed information about a specific function.",
    {
        functionId: z.string().describe("The Glia Function ID."),
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
server.tool(
    "gf_list_function_versions",
    "Lists all versions of a Glia Function, including which one is current.",
    {
        functionId: z.string().describe("The Glia Function ID."),
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
server.tool(
    "gf_deploy_version",
    "Marks an existing function version as the main deployed version.",
    {
        functionId: z.string().describe("The Glia Function ID."),
        versionId: z.string().describe("The function version ID to deploy."),
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
server.tool(
    "gf_invoke_function",
    "Invokes a Glia Function with an optional JSON payload. Returns the raw response.",
    {
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
    },
    async ({ invocationUri, functionId, payloadJson }) => {
        const { api } = await makeApiClient();
        const { parseAndValidateJson } = await importFromProject('src/lib/validation.js');

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
server.tool(
    "gf_fetch_logs",
    "Fetches logs for a function. Useful for debugging from an AI agent.",
    {
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
    },
    async ({ functionId, limit = 1000, startTimeIso, endTimeIso, fetchAll }) => {
        const { fetchLogs } = await importFromProject('src/commands/fetchLogs.js');

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
 * 7) Create a new function
 */
server.tool(
    "gf_create_function",
    "Creates a new Glia Function with the specified name and description.",
    {
        name: z.string().describe("The name of the function."),
        description: z.string().optional().describe("Optional description of the function."),
        warmInstances: z
            .number()
            .int()
            .min(0)
            .max(5)
            .optional()
            .describe("Number of warm instances (0-5). Default is 0."),
    },
    async ({ name, description, warmInstances }) => {
        const { api } = await makeApiClient();
        const { ValidationError } = await importFromProject('src/lib/errors.js');

        try {
            const options = {};
            if (warmInstances !== undefined) {
                options.warmInstances = warmInstances;
            }

            const result = await api.createFunction(name, description || '', options);
            return textResult({
                message: "Function created successfully",
                function: result,
            });
        } catch (err) {
            if (err instanceof ValidationError) {
                return textResult(`Validation error: ${err.message}`);
            }
            return textResult(`Failed to create function: ${err.message}`);
        }
    }
);

/**
 * 8) Delete a function
 */
server.tool(
    "gf_delete_function",
    "Deletes a Glia Function by ID. WARNING: This action cannot be undone.",
    {
        functionId: z.string().describe("The Glia Function ID to delete."),
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
            return textResult(`Failed to delete function: ${err.message}`);
        }
    }
);

/**
 * 9) Update a function
 */
server.tool(
    "gf_update_function",
    "Updates a Glia Function's metadata (name, description, warm instances).",
    {
        functionId: z.string().describe("The Glia Function ID to update."),
        name: z.string().optional().describe("New name for the function."),
        description: z.string().optional().describe("New description for the function."),
        warmInstances: z
            .number()
            .int()
            .min(0)
            .max(5)
            .optional()
            .describe("New number of warm instances (0-5)."),
    },
    async ({ functionId, name, description, warmInstances }) => {
        const { api } = await makeApiClient();
        const { ValidationError } = await importFromProject('src/lib/errors.js');

        try {
            // Build updates object with only provided fields
            const updates = {};
            if (name !== undefined) updates.name = name;
            if (description !== undefined) updates.description = description;
            if (warmInstances !== undefined) updates.warmInstances = warmInstances;

            // Validate at least one field is provided
            if (Object.keys(updates).length === 0) {
                return textResult(
                    "At least one field (name, description, or warmInstances) must be provided."
                );
            }

            const result = await api.updateFunction(functionId, updates);
            return textResult({
                message: "Function updated successfully",
                function: result,
            });
        } catch (err) {
            if (err instanceof ValidationError) {
                return textResult(`Validation error: ${err.message}`);
            }
            return textResult(`Failed to update function: ${err.message}`);
        }
    }
);

/**
 * 10) Create a new function version
 */
server.tool(
    "gf_create_version",
    "Creates a new version of a Glia Function with the provided code. Returns a task that can be polled for completion status.",
    {
        functionId: z.string().describe("The Glia Function ID."),
        code: z.string().describe("The JavaScript code for the function version."),
        compatibilityDate: z
            .string()
            .optional()
            .describe("Workerd compatibility date (e.g., '2023-10-30'). If omitted, uses the maximum supported date."),
        environmentVariables: z
            .record(z.string())
            .optional()
            .describe("Environment variables as key-value pairs."),
    },
    async ({ functionId, code, compatibilityDate, environmentVariables }) => {
        const { api } = await makeApiClient();
        const { ValidationError } = await importFromProject('src/lib/errors.js');

        try {
            const options = {};
            if (compatibilityDate) {
                options.compatibilityDate = compatibilityDate;
            }
            if (environmentVariables) {
                options.environmentVariables = environmentVariables;
            }

            const task = await api.createVersion(functionId, code, options);
            return textResult({
                message: "Function version creation task started",
                task: task,
                note: "Use gf_get_version_task to poll for completion status.",
            });
        } catch (err) {
            if (err instanceof ValidationError) {
                return textResult(`Validation error: ${err.message}`);
            }
            return textResult(`Failed to create function version: ${err.message}`);
        }
    }
);

/**
 * 11) Get version creation task status
 */
server.tool(
    "gf_get_version_task",
    "Gets the status of a function version creation task. Poll this to check if version creation is complete.",
    {
        functionId: z.string().describe("The Glia Function ID."),
        taskId: z.string().describe("The task ID returned from gf_create_version."),
    },
    async ({ functionId, taskId }) => {
        const { api } = await makeApiClient();

        try {
            const taskStatus = await api.getVersionCreationTask(functionId, taskId);
            return textResult(taskStatus);
        } catch (err) {
            return textResult(`Failed to get task status: ${err.message}`);
        }
    }
);

/**
 * 12) List KV pairs in a namespace
 */
server.tool(
    "gf_kv_list",
    "Lists all key-value pairs in a specified KV Store namespace. All KV data expires after 72 hours.",
    {
        namespace: z
            .string()
            .describe("Namespace of the key-value store (max 128 bytes, alphanumeric, underscores, hyphens)."),
        prefix: z
            .string()
            .optional()
            .describe("Optional prefix to filter keys."),
        limit: z
            .number()
            .int()
            .min(1)
            .max(1000)
            .optional()
            .describe("Maximum number of items to return (default 100)."),
    },
    async ({ namespace, prefix, limit }) => {
        const { api } = await makeApiClient();
        const { ValidationError } = await importFromProject('src/lib/errors.js');

        try {
            const options = {};
            if (prefix) options.prefix = prefix;
            if (limit) options.limit = limit;

            const result = await api.listKvPairs(namespace, options);
            return textResult(result);
        } catch (err) {
            if (err instanceof ValidationError) {
                return textResult(`Validation error: ${err.message}`);
            }
            return textResult(`Failed to list KV pairs: ${err.message}`);
        }
    }
);

/**
 * 13) Get a KV value
 */
server.tool(
    "gf_kv_get",
    "Gets a value from the KV Store by key. Returns null if the key doesn't exist or has expired.",
    {
        namespace: z
            .string()
            .describe("Namespace of the key-value store (max 128 bytes, alphanumeric, underscores, hyphens)."),
        key: z
            .string()
            .describe("The key to retrieve (max 512 bytes, alphanumeric, underscores, hyphens)."),
    },
    async ({ namespace, key }) => {
        const { api } = await makeApiClient();
        const { ValidationError } = await importFromProject('src/lib/errors.js');

        try {
            const result = await api.getKvValue(namespace, key);

            if (!result || result.value === null) {
                return textResult({
                    found: false,
                    key: key,
                    namespace: namespace,
                    message: "Key not found or has expired",
                });
            }

            return textResult(result);
        } catch (err) {
            if (err instanceof ValidationError) {
                return textResult(`Validation error: ${err.message}`);
            }
            return textResult(`Failed to get KV value: ${err.message}`);
        }
    }
);

/**
 * 14) Set a KV value
 */
server.tool(
    "gf_kv_set",
    "Sets a key-value pair in the KV Store. Creates a new key or updates an existing one. All data expires after 72 hours.",
    {
        namespace: z
            .string()
            .describe("Namespace of the key-value store (max 128 bytes, alphanumeric, underscores, hyphens)."),
        key: z
            .string()
            .describe("The key to set (max 512 bytes, alphanumeric, underscores, hyphens)."),
        value: z
            .string()
            .describe("The value to store (max 16,000 bytes)."),
    },
    async ({ namespace, key, value }) => {
        const { api } = await makeApiClient();
        const { ValidationError } = await importFromProject('src/lib/errors.js');

        try {
            const result = await api.setKvValue(namespace, key, value);
            return textResult({
                message: "KV value set successfully",
                result: result,
            });
        } catch (err) {
            if (err instanceof ValidationError) {
                return textResult(`Validation error: ${err.message}`);
            }
            return textResult(`Failed to set KV value: ${err.message}`);
        }
    }
);

/**
 * 15) Delete a KV value
 */
server.tool(
    "gf_kv_delete",
    "Deletes a key-value pair from the KV Store by key.",
    {
        namespace: z
            .string()
            .describe("Namespace of the key-value store (max 128 bytes, alphanumeric, underscores, hyphens)."),
        key: z
            .string()
            .describe("The key to delete (max 512 bytes, alphanumeric, underscores, hyphens)."),
    },
    async ({ namespace, key }) => {
        const { api } = await makeApiClient();
        const { ValidationError } = await importFromProject('src/lib/errors.js');

        try {
            const result = await api.deleteKvValue(namespace, key);
            return textResult({
                message: "KV value deleted successfully",
                result: result,
            });
        } catch (err) {
            if (err instanceof ValidationError) {
                return textResult(`Validation error: ${err.message}`);
            }
            return textResult(`Failed to delete KV value: ${err.message}`);
        }
    }
);

/**
 * 16) Test and set a KV value (conditional update)
 */
server.tool(
    "gf_kv_test_and_set",
    "Conditionally updates a KV value only if the current value matches the expected value. Useful for atomic operations and avoiding race conditions.",
    {
        namespace: z
            .string()
            .describe("Namespace of the key-value store (max 128 bytes, alphanumeric, underscores, hyphens)."),
        key: z
            .string()
            .describe("The key to update (max 512 bytes, alphanumeric, underscores, hyphens)."),
        oldValue: z
            .string()
            .nullable()
            .describe("The expected current value (null if key should not exist)."),
        newValue: z
            .string()
            .nullable()
            .describe("The new value to set (null to delete the key)."),
    },
    async ({ namespace, key, oldValue, newValue }) => {
        const { api } = await makeApiClient();
        const { ValidationError } = await importFromProject('src/lib/errors.js');

        try {
            const result = await api.testAndSetKvValue(namespace, key, oldValue, newValue);

            if (!result || result.value === null) {
                return textResult({
                    success: false,
                    message: "Test-and-set failed: current value does not match expected value",
                    key: key,
                });
            }

            return textResult({
                message: "Test-and-set operation successful",
                result: result,
            });
        } catch (err) {
            if (err instanceof ValidationError) {
                return textResult(`Validation error: ${err.message}`);
            }
            return textResult(`Failed to perform test-and-set: ${err.message}`);
        }
    }
);

/**
 * 17) List scheduled triggers
 */
server.tool(
    "gf_list_scheduled_triggers",
    "Lists all scheduled triggers for the current site. Scheduled triggers invoke functions at specified times using cron expressions.",
    {
        verbose: z
            .boolean()
            .optional()
            .describe("If true, include full details for each trigger."),
    },
    async ({ verbose }) => {
        const { api } = await makeApiClient();

        try {
            const result = await api.listScheduledTriggers();

            if (!result || !Array.isArray(result.items)) {
                return textResult("No scheduled triggers found or invalid response.");
            }

            if (verbose) {
                return textResult(result);
            }

            // Return simplified summary
            const summary = result.items.map((t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                trigger_id: t.trigger_id,
                schedule_pattern: t.schedule_pattern,
                enabled: t.enabled,
            }));

            return textResult(summary);
        } catch (err) {
            return textResult(`Failed to list scheduled triggers: ${err.message}`);
        }
    }
);

/**
 * 18) Create a scheduled trigger
 */
server.tool(
    "gf_create_scheduled_trigger",
    "Creates a new scheduled trigger to invoke a function at specified times. Uses Amazon EventBridge cron expression format: 'Minutes Hours Day-of-month Month Day-of-week [Year]'.",
    {
        name: z.string().describe("Name of the scheduled trigger."),
        functionId: z.string().describe("The function ID to invoke on this schedule."),
        schedulePattern: z
            .string()
            .describe("Cron expression (5-6 space-separated fields). Example: '0 2 * * ? *' for daily at 2 AM UTC."),
        description: z
            .string()
            .optional()
            .describe("Optional description of the scheduled trigger."),
    },
    async ({ name, functionId, schedulePattern, description }) => {
        const { api } = await makeApiClient();
        const { ValidationError } = await importFromProject('src/lib/errors.js');

        try {
            const options = {
                name,
                trigger_type: "function",
                trigger_id: functionId,
                schedule_pattern: schedulePattern,
            };

            if (description) {
                options.description = description;
            }

            const result = await api.createScheduledTrigger(options);
            return textResult({
                message: "Scheduled trigger created successfully",
                trigger: result,
            });
        } catch (err) {
            if (err instanceof ValidationError) {
                return textResult(`Validation error: ${err.message}`);
            }
            return textResult(`Failed to create scheduled trigger: ${err.message}`);
        }
    }
);

/**
 * 19) Update a scheduled trigger
 */
server.tool(
    "gf_update_scheduled_trigger",
    "Updates a scheduled trigger's properties. You can update name, description, schedule pattern, or enabled status.",
    {
        triggerId: z.string().describe("The scheduled trigger ID to update."),
        name: z.string().optional().describe("New name for the trigger."),
        description: z.string().optional().describe("New description for the trigger."),
        schedulePattern: z
            .string()
            .optional()
            .describe("New cron expression. Example: '0 2 * * ? *' for daily at 2 AM UTC."),
        enabled: z
            .boolean()
            .optional()
            .describe("Enable (true) or disable (false) the trigger."),
    },
    async ({ triggerId, name, description, schedulePattern, enabled }) => {
        const { api } = await makeApiClient();
        const { ValidationError } = await importFromProject('src/lib/errors.js');

        try {
            // Build updates object with only provided fields
            const updates = {};
            if (name !== undefined) updates.name = name;
            if (description !== undefined) updates.description = description;
            if (schedulePattern !== undefined) updates.schedulePattern = schedulePattern;
            if (enabled !== undefined) updates.enabled = enabled;

            // Validate at least one field is provided
            if (Object.keys(updates).length === 0) {
                return textResult(
                    "At least one field (name, description, schedulePattern, or enabled) must be provided."
                );
            }

            const result = await api.updateScheduledTrigger(triggerId, updates);
            return textResult({
                message: "Scheduled trigger updated successfully",
                trigger: result,
            });
        } catch (err) {
            if (err instanceof ValidationError) {
                return textResult(`Validation error: ${err.message}`);
            }
            return textResult(`Failed to update scheduled trigger: ${err.message}`);
        }
    }
);

/**
 * 20) Delete a scheduled trigger
 */
server.tool(
    "gf_delete_scheduled_trigger",
    "Deletes a scheduled trigger by ID. This stops the function from being invoked on the schedule.",
    {
        triggerId: z.string().describe("The scheduled trigger ID to delete."),
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
            return textResult(`Failed to delete scheduled trigger: ${err.message}`);
        }
    }
);

// Additional tools can be added here (applets, etc.)

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