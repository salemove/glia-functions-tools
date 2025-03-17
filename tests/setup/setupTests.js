import { jest } from '@jest/globals';
import fetchMock from 'jest-fetch-mock';

// Enable fetch mocks for testing API calls
fetchMock.enableMocks();

// Clear all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.resetMocks();
});

// Create common test utilities
global.mockFetch = (status, responseBody) => {
  fetchMock.mockResponseOnce(JSON.stringify(responseBody), { status });
  return fetchMock;
};

// Create mock for environment variables
process.env = {
  ...process.env,
  // Default test environment variables
  GLIA_KEY_ID: 'test-key-id',
  GLIA_KEY_SECRET: 'test-key-secret',
  GLIA_SITE_ID: 'test-site-id',
  GLIA_API_URL: 'https://test-api.glia.com',
  GLIA_BEARER_TOKEN: 'test-bearer-token',
};
