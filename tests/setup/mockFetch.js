import { jest } from '@jest/globals';

// Mock fetch to prevent actual network requests
global.fetch = jest.fn().mockImplementation((url) => {
  console.log(`[MOCK] Intercepted fetch call to: ${url}`);

  // Handle offline detection URLs - return success with no content
  if (url.includes('www.gstatic.com/generate_204') ||
      url.includes('www.google.com/favicon.ico')) {
    return Promise.resolve({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: () => Promise.reject(new Error('No content')),
      text: () => Promise.resolve(''),
      headers: {
        get: () => null,
        entries: () => []
      }
    });
  }

  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: {
      get: () => null,
      entries: () => []
    }
  });
});

// Store original timer functions
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;

// Create a mock AbortController implementation 
if (!global.mockAbortController) {
  class MockAbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    
    abort() {
      this.signal.aborted = true;
    }
  }
  
  global.mockAbortController = MockAbortController;
  global.AbortController = MockAbortController;
}

// Create a mock AbortSignal implementation
global.AbortSignal = {
  timeout: jest.fn(() => ({ aborted: false }))
};