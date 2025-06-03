import { jest } from '@jest/globals';

// Setup test environment
global.fetch = jest.fn(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    status: 200,
    statusText: 'OK',
    headers: {
      get: () => null,
      entries: () => []
    }
  })
);

// Set up environment variables for tests
Object.assign(process.env, {
  GLIA_KEY_ID: 'test-key-id',
  GLIA_KEY_SECRET: 'test-key-secret',
  GLIA_SITE_ID: 'test-site-id',
  GLIA_API_URL: 'https://test-api.glia.com',
  GLIA_BEARER_TOKEN: 'test-bearer-token'
});