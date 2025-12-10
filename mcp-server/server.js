import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// --- STATIC IMPORTS ---
// Ensure these paths match your folder structure exactly
import GliaApiClient from "../src/lib/api.js";
import { getApiConfig } from "../src/lib/config.js";
import { parseAndValidateJson } from "../src/lib/validation.js";
import { AuthenticationError, NetworkError } from "../src/lib/errors.js";
import { fetchLogs } from "../src/commands/fetchLogs.js";
import { 
    validateCronExpression, 
    parseCronExpression, 
    getNextExecutionTime, 
    CRON_PRESETS 
} from "../src/utils/cron-helper.js";
import { validateCode } from "../src/utils/code-validator.js";

const server = new McpServer({
    name: "glia-functions-cli",
    version: "0.1.0",
});

async function makeApiClient() {
    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);
    return { api, apiConfig };
}

function textResult(obj) {
    return {
        content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }],
    };
}

/**
 * 1) List functions
 */
server.tool(
    "gf_list_functions",
    "Lists all Glia Functions.",
    {
        verbose: z.boolean().optional().describe("If true, include raw API response."),
    },
    async ({ verbose } = {}) => {
        const { api } = await makeApiClient();
        try {
            const list = await api.listFunctions();
            if (verbose) return textResult(list);
            return textResult(list?.functions || []);
        } catch (err) {
            return textResult(`Error: ${err.message}`);
        }
    }
);

/**
 * 2) Get function
 */
server.tool(
    "gf_get_function",
    "Get function details.",
    { functionId: z.string() },
    async ({ functionId }) => {
        const { api } = await makeApiClient();
        return textResult(await api.getFunction(functionId));
    }
);

/**
 * 3) List versions
 */
server.tool(
    "gf_list_function_versions",
    "List function versions.",
    { functionId: z.string() },
    async ({ functionId }) => {
        const { api } = await makeApiClient();
        return textResult(await api.listVersions(functionId));
    }
);

/**
 * 4) Deploy version
 */
server.tool(
    "gf_deploy_version",
    "Deploy a function version.",
    { functionId: z.string(), versionId: z.string() },
    async ({ functionId, versionId }) => {
        const { api } = await makeApiClient();
        return textResult(await api.deployVersion(functionId, versionId));
    }
);

/**
 * 5) Invoke function
 */
server.tool(
    "gf_invoke_function",
    "Invoke a function.",
    {
        invocationUri: z.string().optional(),
        functionId: z.string().optional(),
        payloadJson: z.string().optional(),
    },
    async ({ invocationUri, functionId, payloadJson }) => {
        const { api } = await makeApiClient();
        let uri = invocationUri;
        if (!uri) {
            if (!functionId) return textResult("Error: Provide invocationUri or functionId");
            const fn = await api.getFunction(functionId);
            uri = fn.invocation_uri;
        }
        let payload;
        if (payloadJson) payload = JSON.parse(payloadJson);
        return textResult(await api.invokeFunction(uri, payload));
    }
);

/**
 * 6) Fetch logs
 */
server.tool(
    "gf_fetch_logs",
    "Fetch logs.",
    {
        functionId: z.string(),
        limit: z.number().optional(),
        startTimeIso: z.string().optional(),
        endTimeIso: z.string().optional(),
        fetchAll: z.boolean().optional(),
    },
    async ({ functionId, limit, startTimeIso, endTimeIso, fetchAll }) => {
        const options = {
            functionId,
            logsOptions: { limit: limit || 1000, startTime: startTimeIso, endTime: endTimeIso },
            fetchAll: !!fetchAll,
            command: { info: () => {} },
        };
        const logs = await fetchLogs(options);
        return textResult(logs);
    }
);

/**
 * 7) Create function
 */
server.tool(
    "gf_create_function",
    "Create a function.",
    {
        name: z.string(),
        description: z.string().optional(),
        warmInstances: z.number().optional(),
    },
    async ({ name, description, warmInstances }) => {
        const { api } = await makeApiClient();
        const options = warmInstances !== undefined ? { warmInstances } : {};
        const result = await api.createFunction(name, description || "", options);
        return textResult(result);
    }
);

/**
 * 8) Delete function
 */
server.tool(
    "gf_delete_function",
    "Delete a function.",
    { functionId: z.string() },
    async ({ functionId }) => {
        const { api } = await makeApiClient();
        await api.deleteFunction(functionId);
        return textResult({ success: true, functionId });
    }
);

/**
 * 9) Update function
 */
server.tool(
    "gf_update_function",
    "Update function.",
    {
        functionId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        warmInstances: z.number().optional(),
    },
    async ({ functionId, name, description, warmInstances }) => {
        const { api } = await makeApiClient();
        const updates = {};
        if (name) updates.name = name;
        if (description) updates.description = description;
        if (warmInstances !== undefined) updates.warmInstances = warmInstances;
        return textResult(await api.updateFunction(functionId, updates));
    }
);

/**
 * 10) Create version
 * FIX: Replaced z.record() with z.string() for environmentVariables to fix Inspector crash.
 */
server.tool(
    "gf_create_version",
    "Create version. Pass env vars as a JSON string.",
    {
        functionId: z.string(),
        code: z.string(),
        compatibilityDate: z.string().optional(),
        environmentVariablesJson: z.string().optional().describe("JSON string of Key-Value pairs"),
    },
    async ({ functionId, code, compatibilityDate, environmentVariablesJson }) => {
        const { api } = await makeApiClient();
        const options = {};
        if (compatibilityDate) options.compatibilityDate = compatibilityDate;
        if (environmentVariablesJson) {
            try {
                options.environmentVariables = JSON.parse(environmentVariablesJson);
            } catch (e) {
                return textResult("Error: environmentVariablesJson must be valid JSON");
            }
        }
        return textResult(await api.createVersion(functionId, code, options));
    }
);

/**
 * 11) Get task
 */
server.tool(
    "gf_get_version_task",
    "Get version task status.",
    { functionId: z.string(), taskId: z.string() },
    async ({ functionId, taskId }) => {
        const { api } = await makeApiClient();
        return textResult(await api.getVersionCreationTask(functionId, taskId));
    }
);

/**
 * 12) KV List
 */
server.tool(
    "gf_kv_list",
    "List KV pairs.",
    {
        namespace: z.string(),
        prefix: z.string().optional(),
        limit: z.number().optional(),
    },
    async ({ namespace, prefix, limit }) => {
        const { api } = await makeApiClient();
        return textResult(await api.listKvPairs(namespace, { prefix, limit }));
    }
);

/**
 * 13) KV Get
 */
server.tool(
    "gf_kv_get",
    "Get KV value.",
    { namespace: z.string(), key: z.string() },
    async ({ namespace, key }) => {
        const { api } = await makeApiClient();
        return textResult(await api.getKvValue(namespace, key));
    }
);

/**
 * 14) KV Set
 */
server.tool(
    "gf_kv_set",
    "Set KV value.",
    { namespace: z.string(), key: z.string(), value: z.string() },
    async ({ namespace, key, value }) => {
        const { api } = await makeApiClient();
        return textResult(await api.setKvValue(namespace, key, value));
    }
);

/**
 * 15) KV Delete
 */
server.tool(
    "gf_kv_delete",
    "Delete KV value.",
    { namespace: z.string(), key: z.string() },
    async ({ namespace, key }) => {
        const { api } = await makeApiClient();
        return textResult(await api.deleteKvValue(namespace, key));
    }
);

/**
 * 16) KV Test & Set
 * FIX: Removed z.union/z.null. Use string "null" or omit for simplicity to fix Inspector crash.
 */
server.tool(
    "gf_kv_test_and_set",
    "Test and Set KV value. To represent NULL/Non-existent, pass the string 'null' or leave empty.",
    {
        namespace: z.string(),
        key: z.string(),
        oldValue: z.string().optional().describe("Expected current value. Use 'null' for non-existent."),
        newValue: z.string().optional().describe("New value. Use 'null' to delete."),
    },
    async ({ namespace, key, oldValue, newValue }) => {
        const { api } = await makeApiClient();
        
        // Helper to convert string "null" or undefined to actual null
        const resolveVal = (v) => (v === 'null' || v === undefined) ? null : v;
        
        const result = await api.testAndSetKvValue(namespace, key, resolveVal(oldValue), resolveVal(newValue));
        if (!result || result.value === null) return textResult("Mismatch or failed");
        return textResult({ success: true, result });
    }
);

/**
 * 17) List Schedules
 */
server.tool(
    "gf_list_scheduled_triggers",
    "List scheduled triggers.",
    { verbose: z.boolean().optional() },
    async ({ verbose } = {}) => {
        const { api } = await makeApiClient();
        const result = await api.listScheduledTriggers();
        if (verbose) return textResult(result);
        return textResult(result.items.map(t => ({ id: t.id, name: t.name, schedule: t.schedule_pattern })));
    }
);

/**
 * 18) Create Schedule
 */
server.tool(
    "gf_create_scheduled_trigger",
    "Create schedule.",
    {
        name: z.string(),
        functionId: z.string(),
        schedulePattern: z.string(),
        description: z.string().optional(),
    },
    async ({ name, functionId, schedulePattern, description }) => {
        const { api } = await makeApiClient();
        return textResult(await api.createScheduledTrigger({
            name,
            trigger_type: "function",
            trigger_id: functionId,
            schedule_pattern: schedulePattern,
            description
        }));
    }
);

/**
 * 19) Update Schedule
 */
server.tool(
    "gf_update_scheduled_trigger",
    "Update schedule.",
    {
        triggerId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        schedulePattern: z.string().optional(),
        enabled: z.boolean().optional(),
    },
    async ({ triggerId, name, description, schedulePattern, enabled }) => {
        const { api } = await makeApiClient();
        const updates = {};
        if (name) updates.name = name;
        if (description) updates.description = description;
        if (schedulePattern) updates.schedulePattern = schedulePattern;
        if (enabled !== undefined) updates.enabled = enabled;
        return textResult(await api.updateScheduledTrigger(triggerId, updates));
    }
);

/**
 * 20) Delete Schedule
 */
server.tool(
    "gf_delete_scheduled_trigger",
    "Delete schedule.",
    { triggerId: z.string() },
    async ({ triggerId }) => {
        const { api } = await makeApiClient();
        await api.deleteScheduledTrigger(triggerId);
        return textResult({ success: true, triggerId });
    }
);

/**
 * 21) Validate Cron
 */
server.tool(
    "gf_validate_cron",
    "Validate cron expression.",
    { cronExpression: z.string() },
    async ({ cronExpression }) => {
        const val = validateCronExpression(cronExpression);
        if (!val.valid) return textResult({ valid: false, error: val.error });
        return textResult({ valid: true, next: getNextExecutionTime(cronExpression) });
    }
);

/**
 * 22) Validate Code
 */
server.tool(
    "gf_validate_code",
    "Validate JS code.",
    { code: z.string(), strict: z.boolean().optional() },
    async ({ code, strict }) => {
        return textResult(await validateCode(code, { strict }));
    }
);

/**
 * 23) Presets
 */
server.tool(
    "gf_cron_presets",
    "Get cron presets.",
    {},
    async () => {
        return textResult(CRON_PRESETS);
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP server connected via stdio transport');
}

main().catch((err) => {
    console.error("MCP server failed to start:", err);
    process.exit(1);
});
