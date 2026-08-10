import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Mock specifiers resolve relative to tests/setup/setupTests.js, not this file.
// See the note at the bottom of that file.
jest.unstable_mockModule('../../src/lib/api.js', () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.unstable_mockModule('../../src/lib/config.js', () => ({
  __esModule: true,
  getApiConfig: jest.fn()
}));

const { default: GliaApiClient } = await import('../../../src/lib/api.js');
const { getApiConfig } = await import('../../../src/lib/config.js');
const { listFunctions } = await import('../../../src/commands/listFunctions.js');

describe('listFunctions command', () => {
  const mockApiConfig = {
    apiUrl: 'https://test-api.glia.com',
    siteId: 'test-site-id',
    bearerToken: 'test-bearer-token'
  };

  const mockFunctions = {
    functions: [
      { id: 'func1', name: 'Function 1' },
      { id: 'func2', name: 'Function 2' }
    ]
  };

  let mockListFunctions;

  beforeEach(() => {
    mockListFunctions = jest.fn().mockResolvedValue(mockFunctions);
    GliaApiClient.mockImplementation(() => ({ listFunctions: mockListFunctions }));
    getApiConfig.mockResolvedValue(mockApiConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should build a client from the resolved API config', async () => {
    await listFunctions();

    expect(getApiConfig).toHaveBeenCalled();
    // The command routes through BaseCommand.getApiClient, which also sets a
    // log level, so assert on the credentials rather than the whole object.
    expect(GliaApiClient).toHaveBeenCalledWith(expect.objectContaining(mockApiConfig));
  });

  it('should return the functions returned by the API', async () => {
    const result = await listFunctions();

    expect(mockListFunctions).toHaveBeenCalled();
    expect(result).toEqual(mockFunctions);
  });

  it('should return the same result regardless of the detailed flag', async () => {
    // `detailed` only affects how the CLI renders the result, not what is fetched.
    const result = await listFunctions({ detailed: true });

    expect(result).toEqual(mockFunctions);
  });

  it('should propagate API errors to the caller', async () => {
    const testError = new Error('API error');
    mockListFunctions.mockRejectedValue(testError);

    await expect(listFunctions()).rejects.toThrow(testError);
  });
});
