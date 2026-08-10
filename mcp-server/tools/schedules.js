/**
 * MCP tools for scheduled triggers (scheduled functions).
 *
 * The canonical names are gf_*_scheduled_trigger. The older gf_*_schedule names
 * are registered as deprecated aliases so agent configurations written against
 * them keep working; they are documented as deprecated so a model prefers the
 * canonical name.
 */

import { z } from "zod";
import {
  parseCronExpression,
  getNextExecutionTime,
  formatTimeRemaining
} from "../../src/utils/cron-helper.js";
import {
  makeApiClient,
  textResult,
  guarded,
  checkDestructiveGate,
  destructiveArgs
} from "../lib/context.js";

const CRON_NOTE = `Schedule patterns are Amazon EventBridge style, for example
"cron(0 12 * * ? *)" for noon daily. Validate one with gf_validate_cron, or start
from gf_cron_presets.`;

/**
 * Register a deprecated alias for a tool that has been renamed.
 *
 * @param {Object} server - MCP server
 * @param {string} oldName - The retired tool name
 * @param {string} newName - The canonical tool name
 * @param {Object} spec - registerTool spec to reuse
 * @param {Function} handler - The shared handler
 */
function registerAlias(server, oldName, newName, spec, handler) {
  server.registerTool(
    oldName,
    {
      ...spec,
      title: `${spec.title} (deprecated alias)`,
      description: `DEPRECATED: use ${newName} instead. This alias exists only so ` +
        `existing configurations keep working.\n\n${spec.description}`
    },
    handler
  );
}

/**
 * Register the scheduled-trigger tools and their deprecated aliases.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server - MCP server
 */
export function registerScheduleTools(server) {
  // --- list -----------------------------------------------------------------
  const listSpec = {
    title: "List scheduled triggers",
    description: `Lists the scheduled triggers on the site.

Each trigger invokes one function on a recurring schedule. By default this
returns id, name and schedule only; pass verbose for the full records including
enabled state and timestamps.

${CRON_NOTE}`,
    inputSchema: {
      verbose: z.boolean().optional().describe("If true, return the full API records.")
    }
  };
  const listHandler = guarded("Error listing scheduled triggers", async ({ verbose } = {}) => {
    const { api } = await makeApiClient();
    const result = await api.listScheduledTriggers();
    if (verbose) return textResult(result);
    return textResult(
      (result.items || []).map(t => ({ id: t.id, name: t.name, schedule: t.schedule_pattern }))
    );
  });
  server.registerTool("gf_list_scheduled_triggers", listSpec, listHandler);
  registerAlias(server, "gf_list_schedules", "gf_list_scheduled_triggers", listSpec, listHandler);

  // --- get ------------------------------------------------------------------
  const getSpec = {
    title: "Get scheduled trigger details",
    description: `Gets one scheduled trigger, with its schedule explained in words.

Returns the trigger's id, name and description, the function it invokes, the raw
cron pattern together with a human-readable reading of it, whether it is enabled,
and - when enabled - the next execution time and how long until then.

Use this to answer "when does this next run?" without decoding cron by hand.`,
    inputSchema: {
      triggerId: z.string().describe("The scheduled trigger ID.")
    }
  };
  const getHandler = guarded("Error getting scheduled trigger", async ({ triggerId }) => {
    const { api } = await makeApiClient();
    const trigger = await api.getScheduledTrigger(triggerId);

    const nextRun = trigger.enabled ? getNextExecutionTime(trigger.schedule_pattern) : null;

    return textResult({
      trigger: {
        id: trigger.id,
        name: trigger.name,
        functionId: trigger.trigger_id,
        schedulePattern: trigger.schedule_pattern,
        humanReadable: parseCronExpression(trigger.schedule_pattern),
        description: trigger.description || "",
        enabled: trigger.enabled,
        nextExecution: nextRun ? nextRun.toISOString() : "Disabled",
        timeUntilNext: nextRun ? formatTimeRemaining(nextRun) : null,
        createdAt: trigger.created_at,
        updatedAt: trigger.updated_at
      }
    });
  });
  server.registerTool("gf_get_scheduled_trigger", getSpec, getHandler);
  registerAlias(server, "gf_get_schedule", "gf_get_scheduled_trigger", getSpec, getHandler);

  // --- create ---------------------------------------------------------------
  const createSpec = {
    title: "Create a scheduled trigger",
    description: `Schedules a deployed function to run on a recurring pattern.

The function must already have a deployed current version, since the trigger
invokes whatever is current at the time it fires - deploying a new version
changes what a schedule runs, with no change to the trigger.

${CRON_NOTE}`,
    inputSchema: {
      name: z.string().describe("Trigger name, shown in Glia Hub."),
      functionId: z.string().describe("The function to invoke."),
      schedulePattern: z.string().describe('Schedule, for example "cron(0 12 * * ? *)".'),
      description: z.string().optional().describe("What the schedule is for.")
    }
  };
  const createHandler = guarded(
    "Error creating scheduled trigger",
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
  server.registerTool("gf_create_scheduled_trigger", createSpec, createHandler);
  registerAlias(server, "gf_create_schedule", "gf_create_scheduled_trigger", createSpec, createHandler);

  // --- update ---------------------------------------------------------------
  const updateSpec = {
    title: "Update a scheduled trigger",
    description: `Changes a scheduled trigger's name, description, schedule or enabled state.

Setting enabled to false is the non-destructive way to stop a schedule: the
trigger is kept and can be re-enabled, unlike gf_delete_scheduled_trigger.

${CRON_NOTE}`,
    inputSchema: {
      triggerId: z.string().describe("The scheduled trigger ID."),
      name: z.string().optional().describe("New name."),
      description: z.string().optional().describe("New description."),
      schedulePattern: z.string().optional().describe("New schedule pattern."),
      enabled: z.boolean().optional().describe("Enable or disable the trigger.")
    }
  };
  const updateHandler = guarded(
    "Error updating scheduled trigger",
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
  server.registerTool("gf_update_scheduled_trigger", updateSpec, updateHandler);
  registerAlias(server, "gf_update_schedule", "gf_update_scheduled_trigger", updateSpec, updateHandler);

  // --- delete ---------------------------------------------------------------
  const deleteSpec = {
    title: "Delete a scheduled trigger",
    description: `Permanently deletes a scheduled trigger. The function itself is untouched.

Destructive and not reversible. Requires confirm: true. If you only want to stop
the schedule, prefer gf_update_scheduled_trigger with enabled: false, which is
reversible.

Pass dryRun: true to see what would happen without changing anything.`,
    inputSchema: {
      triggerId: z.string().describe("The scheduled trigger ID to delete."),
      ...destructiveArgs(z)
    }
  };
  const deleteHandler = guarded(
    "Error deleting scheduled trigger",
    async ({ triggerId, confirm, dryRun }) => {
      const gate = checkDestructiveGate(
        { confirm, dryRun },
        `deleting scheduled trigger ${triggerId}`
      );
      if (gate) return gate;

      const { api } = await makeApiClient();
      await api.deleteScheduledTrigger(triggerId);
      return textResult({ success: true, deleted: "scheduled_trigger", triggerId });
    }
  );
  server.registerTool("gf_delete_scheduled_trigger", deleteSpec, deleteHandler);
  registerAlias(server, "gf_delete_schedule", "gf_delete_scheduled_trigger", deleteSpec, deleteHandler);
}
