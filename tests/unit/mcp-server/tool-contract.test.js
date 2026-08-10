/**
 * Tool-contract test for the MCP server.
 *
 * Tool names and their required arguments are a public contract: agent
 * configurations reference them by name, and a model chooses between them on
 * their descriptions. A silent rename or removal breaks callers with no error at
 * the point of change — which is exactly what happened when the server moved
 * from src/mcp/ to mcp-server/ and quietly lost three tools and renamed four.
 *
 * This test fails on any change to that surface. When a change is deliberate,
 * update the expectations here in the same commit, so the diff shows it.
 *
 * Assertions compare whole maps rather than looping with per-tool assertions, so
 * a failure names every tool that moved instead of stopping at the first.
 */
import { describe, it, expect } from '@jest/globals';

import { createServer } from '../../../mcp-server/server.js';

/**
 * The complete expected tool surface.
 *
 * `required` lists the arguments a caller must supply. `deprecated` names the
 * canonical tool an alias stands in for. `destructive` marks a tool that must be
 * gated behind confirm/dryRun.
 */
const EXPECTED_TOOLS = {
  // Functions
  gf_list_functions: { required: [] },
  gf_get_function: { required: ['functionId'] },
  gf_create_function: { required: ['name'] },
  gf_update_function: { required: ['functionId'] },
  gf_delete_function: { required: ['functionId'], destructive: true },
  gf_invoke_function: { required: [] },
  gf_fetch_logs: { required: ['functionId'] },

  // Versions and environment variables
  gf_list_function_versions: { required: ['functionId'] },
  gf_create_version: { required: ['code', 'functionId'] },
  gf_get_version_task: { required: ['functionId', 'taskId'] },
  gf_deploy_version: { required: ['functionId', 'versionId'] },
  gf_list_env_vars: { required: ['functionId'] },
  gf_update_env_vars: { required: ['environmentVariables', 'functionId'] },

  // KV store
  gf_kv_list: { required: ['namespace'] },
  gf_kv_get: { required: ['key', 'namespace'] },
  gf_kv_set: { required: ['key', 'namespace', 'value'] },
  gf_kv_delete: { required: ['key', 'namespace'], destructive: true },
  gf_kv_test_and_set: { required: ['key', 'namespace'] },

  // Scheduled triggers
  gf_list_scheduled_triggers: { required: [] },
  gf_get_scheduled_trigger: { required: ['triggerId'] },
  gf_create_scheduled_trigger: { required: ['functionId', 'name', 'schedulePattern'] },
  gf_update_scheduled_trigger: { required: ['triggerId'] },
  gf_delete_scheduled_trigger: { required: ['triggerId'], destructive: true },

  // Deprecated scheduled-trigger aliases
  gf_list_schedules: { required: [], deprecated: 'gf_list_scheduled_triggers' },
  gf_get_schedule: { required: ['triggerId'], deprecated: 'gf_get_scheduled_trigger' },
  gf_create_schedule: {
    required: ['functionId', 'name', 'schedulePattern'],
    deprecated: 'gf_create_scheduled_trigger'
  },
  gf_update_schedule: { required: ['triggerId'], deprecated: 'gf_update_scheduled_trigger' },
  gf_delete_schedule: {
    required: ['triggerId'],
    deprecated: 'gf_delete_scheduled_trigger',
    destructive: true
  },

  // Local validation
  gf_validate_cron: { required: ['cronExpression'] },
  gf_cron_presets: { required: [] },
  gf_validate_code: { required: ['code'] },

  // Applets
  gf_list_applet_templates: { required: [] },
  gf_get_applet_template: { required: ['templateName'] },
  gf_generate_applet_from_template: { required: ['appletName', 'templateName'] },
  gf_list_applets: { required: [] },
  gf_get_applet: { required: ['appletId'] },
  gf_deploy_applet: { required: ['name', 'ownerSiteId', 'source'] },
  gf_update_applet: { required: ['appletId'] },
  gf_delete_applet: { required: ['appletId'], destructive: true }
};

/** Minimum description length. One-liners degrade tool selection measurably. */
const MIN_DESCRIPTION_LENGTH = 120;

const tools = (() => {
  const server = createServer();
  if (!server._registeredTools) {
    throw new Error(
      'McpServer no longer exposes _registeredTools; update this test to read the ' +
      'tool surface another way rather than deleting it.'
    );
  }
  return server._registeredTools;
})();

/**
 * The argument names a tool requires.
 *
 * @param {string} name - Tool name
 * @returns {string[]} Sorted required argument names
 */
function requiredArgs(name) {
  const shape = tools[name]?.inputSchema?.shape ?? {};
  return Object.entries(shape)
    .filter(([, schema]) => !schema.isOptional?.())
    .map(([key]) => key)
    .sort();
}

/**
 * The argument names a tool accepts.
 *
 * @param {string} name - Tool name
 * @returns {string[]} Accepted argument names
 */
function acceptedArgs(name) {
  return Object.keys(tools[name]?.inputSchema?.shape ?? {});
}

describe('MCP tool contract', () => {
  it('registers exactly the expected tools', () => {
    expect(Object.keys(tools).sort()).toEqual(Object.keys(EXPECTED_TOOLS).sort());
  });

  it('keeps the three tools that were dropped in the mcp-server move', () => {
    const names = Object.keys(tools);
    expect(names).toContain('gf_list_env_vars');
    expect(names).toContain('gf_update_env_vars');
    expect(names).toContain('gf_get_schedule');
  });

  it('requires exactly the documented arguments', () => {
    const actual = {};
    const expected = {};
    for (const name of Object.keys(EXPECTED_TOOLS)) {
      actual[name] = requiredArgs(name);
      expected[name] = [...EXPECTED_TOOLS[name].required].sort();
    }
    expect(actual).toEqual(expected);
  });

  it('gives every tool a title', () => {
    const untitled = Object.entries(tools)
      .filter(([, tool]) => !(tool.title ?? tool.annotations?.title))
      .map(([name]) => name);
    expect(untitled).toEqual([]);
  });

  it('gives every tool a description a model can choose on', () => {
    const thin = Object.entries(tools)
      .filter(([, tool]) => (tool.description || '').length <= MIN_DESCRIPTION_LENGTH)
      .map(([name, tool]) => `${name} (${(tool.description || '').length} chars)`);
    expect(thin).toEqual([]);
  });

  it('gates every destructive tool behind confirm and dryRun', () => {
    const ungated = Object.entries(EXPECTED_TOOLS)
      .filter(([, expected]) => expected.destructive)
      .filter(([name]) => {
        const args = acceptedArgs(name);
        return !args.includes('confirm') || !args.includes('dryRun');
      })
      .map(([name]) => name);
    expect(ungated).toEqual([]);
  });

  it('never makes confirmation itself a required argument', () => {
    // A required `confirm` would force every caller to pass it, including on the
    // path that is supposed to refuse; it has to be optional and default to off.
    const wrong = Object.entries(EXPECTED_TOOLS)
      .filter(([, expected]) => expected.destructive)
      .filter(([name]) => requiredArgs(name).includes('confirm'))
      .map(([name]) => name);
    expect(wrong).toEqual([]);
  });

  it('marks deprecated aliases as deprecated and names their replacement', () => {
    const wrong = Object.entries(EXPECTED_TOOLS)
      .filter(([, expected]) => expected.deprecated)
      .filter(([name, expected]) => {
        const description = tools[name].description || '';
        return !description.includes('DEPRECATED') || !description.includes(expected.deprecated);
      })
      .map(([name]) => name);
    expect(wrong).toEqual([]);
  });

  it('does not mark canonical tools as deprecated', () => {
    const wrong = Object.entries(EXPECTED_TOOLS)
      .filter(([, expected]) => !expected.deprecated)
      .filter(([name]) => (tools[name].description || '').includes('DEPRECATED'))
      .map(([name]) => name);
    expect(wrong).toEqual([]);
  });
});
