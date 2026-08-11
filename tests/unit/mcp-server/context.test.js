/**
 * Tests for the MCP tools' shared context helpers.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock specifiers resolve relative to tests/setup/setupTests.js, not this file.
// See the note at the bottom of that file.
jest.unstable_mockModule('../../src/lib/config.js', () => ({
  __esModule: true,
  getApiConfig: jest.fn(),
  refreshBearerTokenIfNeeded: jest.fn()
}));

jest.unstable_mockModule('../../src/lib/api.js', () => ({
  __esModule: true,
  default: jest.fn()
}));

const { getApiConfig, refreshBearerTokenIfNeeded } =
  await import('../../../src/lib/config.js');
const { default: GliaApiClient } = await import('../../../src/lib/api.js');
const {
  makeApiClient,
  textResult,
  errorResult,
  guarded,
  checkDestructiveGate
} = await import('../../../mcp-server/lib/context.js');

describe('makeApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiConfig.mockResolvedValue({
      apiUrl: 'https://test-api.glia.com',
      siteId: 'site-1',
      bearerToken: 'token'
    });
  });

  it('refreshes the bearer token before every call', async () => {
    // Glia tokens last an hour and MCP sessions routinely outlive that. Without
    // this, long sessions failed on raw 401s that surfaced as protocol errors.
    await makeApiClient();

    expect(refreshBearerTokenIfNeeded).toHaveBeenCalledTimes(1);
  });

  it('refreshes before reading the config, not after', async () => {
    const order = [];
    refreshBearerTokenIfNeeded.mockImplementation(async () => order.push('refresh'));
    getApiConfig.mockImplementation(async () => {
      order.push('getConfig');
      return { apiUrl: 'u', siteId: 's', bearerToken: 't' };
    });

    await makeApiClient();

    // Reading the config first would hand the client the stale token.
    expect(order).toEqual(['refresh', 'getConfig']);
  });

  it('builds the client from the resolved config', async () => {
    await makeApiClient();

    expect(GliaApiClient).toHaveBeenCalledWith(expect.objectContaining({ siteId: 'site-1' }));
  });
});

describe('result helpers', () => {
  it('serialises objects and passes strings through', () => {
    expect(textResult('plain').content[0].text).toBe('plain');
    expect(JSON.parse(textResult({ a: 1 }).content[0].text)).toEqual({ a: 1 });
    expect(textResult('plain').isError).toBeUndefined();
  });

  it('flags errors so a client can tell them from ordinary content', () => {
    const result = errorResult('Something failed', new Error('root cause'));

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Something failed: root cause');
  });

  it('turns a thrown error into an error result rather than a protocol failure', async () => {
    const handler = guarded('Error doing the thing', async () => {
      throw new Error('boom');
    });

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error doing the thing: boom');
  });

  it('passes a successful handler result through untouched', async () => {
    const handler = guarded('Error', async () => textResult('fine'));

    expect(await handler({})).toEqual(textResult('fine'));
  });
});

describe('checkDestructiveGate', () => {
  afterEach(() => {
    delete process.env.GLIA_MCP_ALLOW_DESTRUCTIVE;
  });

  it('refuses when confirmation is absent', () => {
    const result = checkDestructiveGate({}, 'deleting everything');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('deleting everything');
    expect(result.content[0].text).toContain('confirm: true');
  });

  it('refuses when confirmation is explicitly false', () => {
    expect(checkDestructiveGate({ confirm: false }, 'x').isError).toBe(true);
  });

  it('refuses a truthy non-true confirmation', () => {
    // A model emitting the string "true" should not clear a deletion gate.
    expect(checkDestructiveGate({ confirm: 'true' }, 'x').isError).toBe(true);
  });

  it('allows the operation through when confirmed', () => {
    expect(checkDestructiveGate({ confirm: true }, 'x')).toBeNull();
  });

  it('reports a dry run without performing anything, even when confirmed', () => {
    const result = checkDestructiveGate({ confirm: true, dryRun: true }, 'deleting function abc');

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.dryRun).toBe(true);
    expect(payload.wouldPerform).toBe('deleting function abc');
  });

  it('honours the session-wide escape hatch', () => {
    process.env.GLIA_MCP_ALLOW_DESTRUCTIVE = 'true';

    expect(checkDestructiveGate({}, 'x')).toBeNull();
  });

  it('does not treat any other value of the escape hatch as permission', () => {
    process.env.GLIA_MCP_ALLOW_DESTRUCTIVE = '1';

    expect(checkDestructiveGate({}, 'x').isError).toBe(true);
  });
});
