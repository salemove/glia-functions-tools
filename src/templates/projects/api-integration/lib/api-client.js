/**
 * API Client for {{projectName}}
 * 
 * Handles communication with external APIs
 */

/**
 * Custom API error classes
 */
export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export class ApiTimeoutError extends ApiError {
  constructor(message) {
    super(message, 'API_TIMEOUT');
    this.name = 'ApiTimeoutError';
  }
}

export class ApiAuthError extends ApiError {
  constructor(message) {
    super(message, 'API_AUTH_ERROR');
    this.name = 'ApiAuthError';
  }
}

/**
 * Make an API request with proper error handling and timeout
 * 
 * @param {Object} options - Request options
 * @param {string} options.url - API URL
 * @param {string} options.method - HTTP method (GET, POST, etc.)
 * @param {string} options.apiKey - API key for authentication
 * @param {Object} options.payload - Request payload
 * @param {number} options.timeout - Request timeout in milliseconds
 * @returns {Promise<Object>} API response data
 * @throws {ApiError} On API errors
 */
export async function makeApiRequest(options) {
  const { url, method, apiKey, payload, timeout = 5000 } = options;
  
  // Set up timeout with AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    // Prepare headers with authentication
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Glia-Function/{{version}}'
    };
    
    // Make the request
    const response = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' ? JSON.stringify(payload) : undefined,
      signal: controller.signal
    });
    
    // Check for rate limiting
    if (response.headers.has('X-Rate-Limit-Remaining')) {
      const remaining = parseInt(response.headers.get('X-Rate-Limit-Remaining'), 10);
      if (remaining < 10) {
        console.warn(`[{{projectName}}] API rate limit running low: ${remaining} calls remaining`);
      }
    }
    
    // Handle API errors
    if (!response.ok) {
      // Try to parse error response
      const errorText = await response.text();
      let errorData = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        // If not JSON, use the text directly
        errorData = { message: errorText };
      }
      
      // Handle specific error cases
      if (response.status === 401 || response.status === 403) {
        throw new ApiAuthError(errorData.message || 'Authentication failed');
      } else {
        throw new ApiError(
          errorData.message || `API error: ${response.status} ${response.statusText}`,
          errorData.code || `HTTP_${response.status}`
        );
      }
    }
    
    // Parse successful response
    return await response.json();
    
  } catch (error) {
    // Handle abort (timeout) errors
    if (error.name === 'AbortError') {
      throw new ApiTimeoutError(`Request timed out after ${timeout}ms`);
    }
    
    // Re-throw ApiError instances
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Wrap other errors
    throw new ApiError(`API request failed: ${error.message}`, 'REQUEST_FAILED');
    
  } finally {
    clearTimeout(timeoutId);
  }
}