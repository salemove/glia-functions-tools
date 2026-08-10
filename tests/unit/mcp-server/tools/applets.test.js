/**
 * Behaviour tests for the applet MCP tool handlers.
 *
 * Registration shape - names, titles, descriptions, required arguments and the
 * destructive gate - is covered once for every tool in
 * tests/unit/mcp-server/tool-contract.test.js. This file covers what those
 * handlers actually decide before reaching the API: input validation, the
 * confirmation gate, and JSON parsing.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import {
  registerGenerateAppletFromTemplate,
  registerDeployApplet,
  registerUpdateApplet,
  registerDeleteApplet,
  registerAppletTools,
  registerAllAppletTools
} from '../../../../mcp-server/tools/applets.js';

/**
 * A server stub that captures registerTool calls.
 *
 * @returns {{server: Object, registeredTools: Record<string, Object>}} Stub and captures
 */
function createMockServer() {
  const registeredTools = {};
  const server = {
    registerTool: jest.fn((name, spec, handler) => {
      registeredTools[name] = { name, ...spec, handler };
    })
  };
  return { server, registeredTools };
}

/**
 * Extract the handler for a single tool.
 *
 * @param {Function} register - The register function for that tool
 * @param {string} name - Tool name
 * @returns {Function} The tool handler
 */
function handlerFor(register, name) {
  const { server, registeredTools } = createMockServer();
  register(server);
  return registeredTools[name].handler;
}

/**
 * Read the text payload of a tool result.
 *
 * @param {Object} result - MCP tool result
 * @returns {string} The text content
 */
function textOf(result) {
  expect(result).toHaveProperty('content');
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe('text');
  return result.content[0].text;
}

describe('registerAppletTools', () => {
  it('registers every applet tool', () => {
    const { server, registeredTools } = createMockServer();
    registerAppletTools(server);

    expect(Object.keys(registeredTools).sort()).toEqual([
      'gf_delete_applet',
      'gf_deploy_applet',
      'gf_generate_applet_from_template',
      'gf_get_applet',
      'gf_get_applet_template',
      'gf_list_applet_templates',
      'gf_list_applets',
      'gf_update_applet'
    ]);
  });

  it('keeps registerAllAppletTools working as a deprecated alias', () => {
    expect(registerAllAppletTools).toBe(registerAppletTools);
  });
});

describe('gf_deploy_applet input validation', () => {
  let handler;

  beforeEach(() => {
    handler = handlerFor(registerDeployApplet, 'gf_deploy_applet');
  });

  it('refuses empty HTML', async () => {
    const result = await handler({ name: 'Test', ownerSiteId: 'site-1', source: '' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/required|empty/i);
  });

  it('refuses whitespace-only HTML', async () => {
    const result = await handler({ name: 'Test', ownerSiteId: 'site-1', source: '   ' });

    expect(result.isError).toBe(true);
  });

  it('refuses content that is not an HTML document', async () => {
    const result = await handler({
      name: 'Test',
      ownerSiteId: 'site-1',
      source: 'just plain text, no html tags'
    });

    // Glia embeds the page as-is, so a fragment fails silently in the console.
    // Catching it here is the difference between an error and a mystery.
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/html/i);
    expect(textOf(result)).toMatch(/nothing was deployed/i);
  });

  it('accepts a document declared with DOCTYPE', async () => {
    const result = await handler({
      name: 'Test',
      ownerSiteId: 'site-1',
      source: '<!DOCTYPE html><html><body>Hello</body></html>'
    });

    // No API is reachable here, so this gets past validation and fails later.
    // The point is that it is not rejected as malformed.
    expect(textOf(result)).not.toMatch(/does not look like a document/i);
  });

  it('accepts a document declared with an html tag', async () => {
    const result = await handler({
      name: 'Test',
      ownerSiteId: 'site-1',
      source: '<html><body>Hello</body></html>'
    });

    expect(textOf(result)).not.toMatch(/does not look like a document/i);
  });
});

describe('gf_update_applet input validation', () => {
  let handler;

  beforeEach(() => {
    handler = handlerFor(registerUpdateApplet, 'gf_update_applet');
  });

  it('refuses an update with no fields', async () => {
    const result = await handler({ appletId: 'applet-1' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/at least one field/i);
  });

  it('accepts an update that only changes the name', async () => {
    const result = await handler({ appletId: 'applet-1', name: 'Renamed' });

    expect(textOf(result)).not.toMatch(/at least one field/i);
  });

  it('accepts an update that only replaces the source', async () => {
    const result = await handler({ appletId: 'applet-1', source: '<html></html>' });

    expect(textOf(result)).not.toMatch(/at least one field/i);
  });
});

describe('gf_delete_applet confirmation gate', () => {
  let handler;

  beforeEach(() => {
    handler = handlerFor(registerDeleteApplet, 'gf_delete_applet');
    delete process.env.GLIA_MCP_ALLOW_DESTRUCTIVE;
  });

  it('refuses when confirm is false', async () => {
    const result = await handler({ appletId: 'applet-1', confirm: false });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/not confirmed/i);
  });

  it('refuses when confirm is omitted', async () => {
    const result = await handler({ appletId: 'applet-1' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/not confirmed/i);
  });

  it('reports what it would do for a dry run, and does not delete', async () => {
    const result = await handler({ appletId: 'applet-1', dryRun: true });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(textOf(result));
    expect(payload.dryRun).toBe(true);
    expect(payload.wouldPerform).toContain('applet-1');
  });

  it('proceeds past the gate when confirm is true', async () => {
    const result = await handler({ appletId: 'applet-1', confirm: true });

    // It gets past the gate and then fails at the API, which is the expected
    // outcome with no server reachable. What matters is that it is not refused.
    expect(textOf(result)).not.toMatch(/not confirmed/i);
  });
});

describe('gf_generate_applet_from_template input validation', () => {
  let handler;

  beforeEach(() => {
    handler = handlerFor(registerGenerateAppletFromTemplate, 'gf_generate_applet_from_template');
  });

  it('refuses malformed variablesJson', async () => {
    const result = await handler({
      templateName: 'basic-html',
      appletName: 'Test',
      variablesJson: '{not valid json'
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/valid json/i);
  });

  it('generates applet HTML from a real template', async () => {
    const result = await handler({
      templateName: 'basic-html',
      appletName: 'Smoke Applet',
      description: 'Generated by a test'
    });

    const payload = JSON.parse(textOf(result));
    expect(payload.templateUsed).toBe('basic-html');
    expect(payload.appletHtml).toContain('Smoke Applet');
    // Substitution must have happened; an unrendered placeholder means the
    // template engine silently did nothing.
    expect(payload.appletHtml).not.toContain('{{appletName}}');
  });
});
