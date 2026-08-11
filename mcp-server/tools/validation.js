/**
 * MCP tools that validate input locally, without calling the API.
 *
 * These are cheap and have no side effects, so they are the right thing to run
 * before gf_create_version or gf_create_scheduled_trigger rather than finding
 * out from a 422.
 */

import { z } from "zod";
import {
  validateCronExpression,
  parseCronExpression,
  getNextExecutionTime,
  CRON_PRESETS
} from "../../src/utils/cron-helper.js";
import { validateCode } from "../../src/utils/code-validator.js";
import { textResult, guarded } from "../lib/context.js";

/**
 * Register the local validation tools.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server - MCP server
 */
export function registerValidationTools(server) {
  server.registerTool(
    "gf_validate_cron",
    {
      title: "Validate a schedule pattern",
      description: `Checks an EventBridge-style cron expression and says when it would next fire.

Runs locally, so it costs nothing and changes nothing. Use it before
gf_create_scheduled_trigger.

Note the EventBridge shape: six fields, and either day-of-month or day-of-week
must be "?". "cron(0 12 * * ? *)" is noon every day.`,
      inputSchema: {
        cronExpression: z.string().describe('Expression to check, for example "cron(0 12 * * ? *)".')
      }
    },
    guarded("Error validating cron expression", async ({ cronExpression }) => {
      const result = validateCronExpression(cronExpression);
      if (!result.valid) {
        return textResult({ valid: false, error: result.error });
      }
      return textResult({
        valid: true,
        humanReadable: parseCronExpression(cronExpression),
        nextExecution: getNextExecutionTime(cronExpression)
      });
    })
  );

  server.registerTool(
    "gf_cron_presets",
    {
      title: "List schedule presets",
      description: `Lists ready-made schedule patterns with plain-English descriptions.

Prefer a preset over hand-writing cron: the EventBridge dialect differs from
standard cron in ways that are easy to get wrong. Each entry gives an expression
you can pass straight to gf_create_scheduled_trigger.`,
      inputSchema: {}
    },
    guarded("Error listing cron presets", async () => textResult(CRON_PRESETS))
  );

  server.registerTool(
    "gf_validate_code",
    {
      title: "Validate function code",
      description: `Checks function source before you upload it with gf_create_version.

Looks for the things the runtime will reject or that will silently misbehave: a
missing onInvoke export, Node built-ins that workerd does not provide, and
patterns that will not survive bundling.

Runs locally and changes nothing. Cheaper than discovering the problem from a
failed version-creation task.`,
      inputSchema: {
        code: z.string().describe("Function source to check."),
        strict: z.boolean().optional().describe("If true, treat warnings as failures.")
      }
    },
    guarded("Error validating code", async ({ code, strict }) =>
      textResult(await validateCode(code, { strict }))
    )
  );
}
