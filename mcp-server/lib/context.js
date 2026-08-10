/**
 * Shared helpers for the Glia Functions MCP tools.
 *
 * Every tool module gets its API client and its result formatting from here, so
 * authentication behaviour and the shape of returned content are defined once.
 */

import GliaApiClient from "../../src/lib/api.js";
import { getApiConfig, refreshBearerTokenIfNeeded } from "../../src/lib/config.js";

/**
 * Build an API client for a tool invocation.
 *
 * The bearer token is refreshed first. Glia tokens last an hour and an MCP
 * session routinely outlives that; without this, every long session started
 * failing with raw 401s that surfaced to the client as protocol errors.
 *
 * @returns {Promise<{api: GliaApiClient, apiConfig: Object}>} Client and config
 */
export async function makeApiClient() {
  await refreshBearerTokenIfNeeded();
  const apiConfig = await getApiConfig();
  const api = new GliaApiClient(apiConfig);
  return { api, apiConfig };
}

/**
 * Format a successful tool result.
 *
 * @param {any} obj - String to return verbatim, or a value to serialise
 * @returns {Object} An MCP tool result
 */
export function textResult(obj) {
  return {
    content: [
      { type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }
    ]
  };
}

/**
 * Format a failed tool result.
 *
 * isError is set so the client can tell a failure from a successful call that
 * happened to return the word "Error", which is all the previous
 * `textResult(\`Error: ...\`)` convention conveyed.
 *
 * @param {string} message - What went wrong
 * @param {Error} [cause] - Underlying error, if any
 * @returns {Object} An MCP tool result flagged as an error
 */
export function errorResult(message, cause) {
  const detail = cause?.message ? `${message}: ${cause.message}` : message;
  return {
    isError: true,
    content: [{ type: "text", text: detail }]
  };
}

/**
 * Wrap a tool handler so a thrown error becomes an error result rather than a
 * protocol-level failure.
 *
 * @param {string} label - Prefix for the error message
 * @param {Function} handler - The tool handler
 * @returns {Function} The wrapped handler
 */
export function guarded(label, handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResult(label, error);
    }
  };
}

/**
 * Whether the destructive-operation gate has been lifted for the whole session.
 *
 * @returns {boolean} True if GLIA_MCP_ALLOW_DESTRUCTIVE is set to "true"
 */
export function destructiveAllowedGlobally() {
  return process.env.GLIA_MCP_ALLOW_DESTRUCTIVE === "true";
}

/**
 * Check the confirmation gate for a destructive tool.
 *
 * These tools delete real resources on a live site, unauthenticated, over
 * stdio, at the discretion of a model. Requiring an explicit `confirm: true`
 * makes the deletion a deliberate act rather than a plausible next token.
 *
 * @param {Object} args - Tool arguments
 * @param {boolean} [args.confirm] - Caller's explicit confirmation
 * @param {boolean} [args.dryRun] - Report what would happen and stop
 * @param {string} description - Human-readable description of the operation
 * @returns {Object|null} A result to return immediately, or null to proceed
 */
export function checkDestructiveGate({ confirm, dryRun }, description) {
  if (dryRun) {
    return textResult({
      dryRun: true,
      wouldPerform: description,
      note: "Nothing was changed. Re-run with confirm: true to perform this."
    });
  }

  if (confirm === true || destructiveAllowedGlobally()) {
    return null;
  }

  return errorResult(
    `Refused: ${description} is destructive and was not confirmed. ` +
    "Pass confirm: true to proceed, or dryRun: true to see what would happen. " +
    "Set GLIA_MCP_ALLOW_DESTRUCTIVE=true to lift this gate for the whole session."
  );
}

/**
 * The confirmation arguments shared by every destructive tool.
 *
 * @param {import("zod").ZodTypeAny} z - The zod namespace
 * @returns {Object} A partial input schema shape
 */
export function destructiveArgs(z) {
  return {
    confirm: z
      .boolean()
      .optional()
      .describe("Must be true to actually perform this destructive operation."),
    dryRun: z
      .boolean()
      .optional()
      .describe("If true, report what would be deleted and make no changes.")
  };
}
