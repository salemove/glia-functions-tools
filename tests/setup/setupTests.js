import { jest, beforeEach } from '@jest/globals';
import fetchMock from 'jest-fetch-mock';

/**
 * One fetch mock for the whole suite.
 *
 * jest-fetch-mock was a declared dependency that nothing ever enabled, while
 * two setup files hand-rolled competing `global.fetch = jest.fn()` stubs. Tests
 * written against `fetchMock.mockResponseOnce(...)` therefore failed on an
 * undefined global. Enabling it here makes it the single source of truth, and
 * exposing it as `global.fetchMock` keeps the existing call sites working.
 */
fetchMock.enableMocks();

/**
 * jest-fetch-mock labels every response `text/plain`. GliaApiClient inspects
 * `content-type` to decide whether to parse a body, so a staged JSON string
 * would otherwise come back as a string and every assertion on a parsed object
 * would fail.
 *
 * Rather than repeat an explicit header at ~80 call sites, default a body that
 * parses as JSON to `application/json`, preserving any other init fields. A
 * test that sets its own content-type, or stages a genuinely non-JSON body, is
 * left untouched — which is what the "should handle non-JSON responses" cases
 * depend on.
 *
 * @param {Function} original - The jest-fetch-mock method being wrapped
 * @returns {Function} The wrapped method
 */
function withJsonContentType(original) {
  return function (...args) {
    const [body, init] = args;

    if (typeof body !== 'string') return original.apply(this, args);

    try {
      JSON.parse(body);
    } catch {
      // Not JSON; let jest-fetch-mock label it text/plain.
      return original.apply(this, args);
    }

    const headers = { ...(init?.headers || {}) };
    const hasContentType = Object.keys(headers).some(
      key => key.toLowerCase() === 'content-type'
    );
    if (hasContentType) return original.apply(this, args);

    return original.call(this, body, {
      ...init,
      headers: { ...headers, 'content-type': 'application/json' }
    });
  };
}

fetchMock.mockResponse = withJsonContentType(fetchMock.mockResponse.bind(fetchMock));
fetchMock.mockResponseOnce = withJsonContentType(fetchMock.mockResponseOnce.bind(fetchMock));
fetchMock.once = fetchMock.mockResponseOnce;

global.fetchMock = fetchMock;
global.fetch = fetchMock;

beforeEach(() => {
  fetchMock.resetMocks();

  // Default to an empty JSON 200 so a test that forgets to stage a response
  // fails on its assertion rather than on an unhandled rejection.
  fetchMock.mockResponse(JSON.stringify({}));
});

// Set up environment variables for tests
Object.assign(process.env, {
  GLIA_KEY_ID: 'test-key-id',
  GLIA_KEY_SECRET: 'test-key-secret',
  GLIA_SITE_ID: 'test-site-id',
  GLIA_API_URL: 'https://test-api.glia.com',
  GLIA_BEARER_TOKEN: 'test-bearer-token'
});


/**
 * A note on module mocking, because it is not obvious.
 *
 * Under ESM (`"type": "module"`, `--experimental-vm-modules`, `transform: {}`):
 *
 *  - `jest.mock()` does nothing. It neither hoists nor replaces the module.
 *    `jest.unstable_mockModule()` is the only mechanism that works, and the
 *    module under test must be imported with a dynamic `await import(...)`
 *    *after* the mock is registered.
 *
 *  - Mock specifiers are resolved relative to THIS FILE, not relative to the
 *    test file that calls them. So every test file, at whatever depth, refers to
 *    source modules as `../../src/...` inside `unstable_mockModule`, while its
 *    ordinary `import`/`await import` statements use its own real depth. That
 *    mismatch is what produced the "Cannot find module ... from
 *    tests/setup/setupTests.js" failures.
 */
