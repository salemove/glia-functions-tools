/**
 * Glia API Client
 * 
 * A robust client for interacting with the Glia API that provides:
 * - Request/response handling with proper content type support
 * - Authentication management
 * - Retry mechanism with exponential backoff
 * - Circuit breaker pattern to prevent cascading failures
 * - Request caching for improved performance
 * - Idempotency key support for safe retries of mutation operations
 * - Request cancellation for managing in-flight requests
 * - Prefetching of related resources
 * 
 * @module api
 */

// Import Node.js specific packages
import fs from 'fs/promises';
import FormData from 'form-data';
import nodeFetch from 'node-fetch';

// Use node-fetch for consistent behavior in Node.js environment
const fetch = nodeFetch;

// Set up for debugging
const DEBUG_API = true;

import { 
  GliaError, 
  AuthenticationError, 
  NetworkError, 
  FunctionError,
  ValidationError,
  RateLimitError
} from './errors.js';

import { validateFunctionId, validateFunctionName } from './validation.js';
import { withRetry, CircuitBreaker, DEFAULT_RETRY_CONFIG } from './retry.js';
import { ResponseCache, DEFAULT_CACHE_CONFIG } from './cache.js';
import { OfflineManager, DEFAULT_OFFLINE_CONFIG } from './offline.js';

/**
 * Default API client configuration
 */
export const DEFAULT_API_CONFIG = {
  caching: DEFAULT_CACHE_CONFIG,
  retry: DEFAULT_RETRY_CONFIG,
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxCalls: 1
  },
  offline: DEFAULT_OFFLINE_CONFIG,
  requests: {
    defaultTimeout: 30000,      // 30 seconds default timeout
    prefetchEnabled: false,     // Prefetching disabled by default
    idempotencyEnabled: true,   // Enable idempotency keys by default
    idempotencyHeader: 'X-Idempotency-Key',
    followRedirect: true,       // Follow redirects by default
    maxRedirects: 5            // Maximum number of redirects to follow
  },
  // Logging configuration
  logging: {
    level: 'info',           // Default log level: 'silent', 'error', 'warn', 'info', 'debug', 'trace'
    includeTimestamps: true, // Include timestamps in log messages
    includeRequestIds: false // Include request IDs in all log messages
  }
};

/**
 * Glia API Client
 */
export default class GliaApiClient {
  /**
   * Create a new Glia API Client
   * 
   * @param {Object} config - API configuration
   * @param {string} config.apiUrl - API base URL
   * @param {string} config.siteId - Glia site ID
   * @param {string} config.bearerToken - Bearer token for authentication
   * @param {Object} config.caching - Cache configuration (see DEFAULT_CACHE_CONFIG)
   * @param {Object} config.retry - Retry configuration (see DEFAULT_RETRY_CONFIG)
   * @param {Object} config.circuitBreaker - Circuit breaker configuration
   */
  constructor(config) {
    this.baseUrl = config.apiUrl;
    this.siteId = config.siteId;
    this.bearerToken = config.bearerToken;
    
    // Store error classes for use in _createError method
    this.errors = { GliaError, FunctionError };
    
    // Initialize cache if enabled
    const cacheConfig = { 
      ...DEFAULT_API_CONFIG.caching,
      ...(config.caching || {})
    };
    
    this.cache = new ResponseCache(cacheConfig);
    
    // Initialize retry configuration
    this.retryConfig = {
      ...DEFAULT_API_CONFIG.retry,
      ...(config.retry || {})
    };
    
    // Initialize circuit breaker if enabled
    const cbConfig = {
      ...DEFAULT_API_CONFIG.circuitBreaker,
      ...(config.circuitBreaker || {})
    };
    
    this.circuitBreaker = cbConfig.enabled ? 
      new CircuitBreaker({
        failureThreshold: cbConfig.failureThreshold,
        resetTimeoutMs: cbConfig.resetTimeoutMs,
        halfOpenMaxCalls: cbConfig.halfOpenMaxCalls
      }) : 
      null;
    
    // Initialize request configuration
    this.requestConfig = {
      ...DEFAULT_API_CONFIG.requests,
      ...(config.requests || {})
    };
    
    // Log redirect configuration if debug logging enabled
    if (this.logRequests) {
      console.log(`[API] Redirect handling: ${this.requestConfig.followRedirect ? 'enabled' : 'disabled'}, max redirects: ${this.requestConfig.maxRedirects}`);
    }
    
    // Track active requests for cancellation support
    this.activeRequests = new Map();
    
    // Prefetch cache for storing prefetched data
    this.prefetchCache = new Map();
    
    // Initialize offline manager with proper config
    const offlineConfig = {
      ...DEFAULT_API_CONFIG.offline,
      ...(config.offline || {})
      // Remove the forced disabled status to respect user configuration
    };
    
    // Create the offline manager but with more reliable network detection
    this.offlineManager = new OfflineManager({
      ...offlineConfig,
      // Use a more reliable network check URL - Google's connectivity check
      networkCheckUrl: 'https://www.gstatic.com/generate_204',
      // Pass through the log level
      logLevel: this.logLevel
    });
    
    // Initialize offline manager with better error handling
    if (this.offlineManager) {
      // Log that we're initializing offline support when enabled
      if (offlineConfig.enabled && this.logRequests) {
        console.log('[API] Initializing offline support');
      }
      
      // Provide the makeRequest method to the offline manager
      this.offlineManager.setExecuteFunction((endpoint, options, requestOptions) => {
        return this.makeRequest(endpoint, options, requestOptions);
      });
      
      this.offlineManager.init().catch(err => {
        console.error('Failed to initialize offline manager:', err);
      });
    }
      
    // Configure request logging
    const loggingConfig = {
      ...DEFAULT_API_CONFIG.logging,
      ...(config.logging || {})
    };
    
    // Set log level and features
    this.logLevel = config.logLevel || loggingConfig.level || 'info';
    // Valid log levels: 'silent', 'error', 'warn', 'info', 'debug', 'trace'
    this.includeTimestamps = loggingConfig.includeTimestamps;
    this.includeRequestIds = loggingConfig.includeRequestIds;
    // For backward compatibility
    this.logRequests = (config.logRequests || this.logLevel === 'debug' || this.logLevel === 'trace');
  }
  
  /**
   * Generate a unique identifier for requests
   * Used for idempotency keys and request tracking
   * 
   * @returns {string} A unique request ID
   * @private
   */
  _generateRequestId() {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `req_${timestamp}_${randomPart}`;
  }
  
  /**
   * Cancels any pending requests that match the filter
   * 
   * @param {Function|string} filter - If string, matches against endpoint; if function, calls with (endpoint, requestId)
   * @returns {number} Number of requests cancelled
   */
  cancelRequests(filter) {
    let count = 0;
    
    this.activeRequests.forEach((controller, requestId) => {
      const endpoint = requestId.split('::')[0];
      
      const shouldCancel = typeof filter === 'function' 
        ? filter(endpoint, requestId)
        : endpoint.includes(filter);
        
      if (shouldCancel) {
        controller.abort();
        this.activeRequests.delete(requestId);
        count++;
        
        if (this.logRequests) {
          console.log(`[API] Cancelled request: ${requestId}`);
        }
      }
    });
    
    return count;
  }
  
  /**
   * Prefetches data for a specified endpoint
   * 
   * @param {string} endpoint - The endpoint to prefetch
   * @param {Object} options - Request options
   * @param {Object} requestOptions - Additional request options
   * @returns {Promise<void>} - Promise that resolves when prefetching is complete
   */
  async prefetch(endpoint, options = {}, requestOptions = {}) {
    if (!this.requestConfig.prefetchEnabled) {
      return;
    }
    
    try {
      if (this.logRequests) {
        console.log(`[API] Prefetching: ${endpoint}`);
      }
      
      // Clone options and mark as prefetch
      const prefetchOptions = { ...options };
      const prefetchRequestOptions = { 
        ...requestOptions,
        isPrefetch: true,
        useRetry: false, // Don't retry prefetch requests
        timeout: requestOptions.timeout || 5000 // Shorter timeout for prefetch
      };
      
      // Execute the request in the background
      const result = await this.makeRequest(endpoint, prefetchOptions, prefetchRequestOptions);
      
      // Store in prefetch cache
      const cacheKey = this._generateCacheKey(endpoint, options);
      this.prefetchCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      if (this.logRequests) {
        console.log(`[API] Prefetch complete: ${endpoint}`);
      }
    } catch (error) {
      // Silent fail for prefetch - just log if enabled
      if (this.logRequests) {
        console.log(`[API] Prefetch failed: ${endpoint}`, error.message);
      }
    }
  }
  
  /**
   * Generate a consistent cache key from endpoint and options
   * 
   * @private
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {string} - Cache key
   */
  _generateCacheKey(endpoint, options) {
    // Use endpoint as base key
    let key = endpoint;
    
    // Add method to key
    const method = options.method || 'GET';
    key += `::${method}`;
    
    // Add body hash to key if present (for POST/PUT/PATCH)
    if (options.body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      try {
        // Try to create a consistent hash of the body
        const bodyStr = typeof options.body === 'string' 
          ? options.body 
          : JSON.stringify(options.body);
          
        // Simple string hash function
        let hash = 0;
        for (let i = 0; i < bodyStr.length; i++) {
          const char = bodyStr.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        key += `::${hash}`;
      } catch (error) {
        // If hashing fails, add a timestamp to ensure uniqueness
        key += `::${Date.now()}`;
      }
    }
    
    return key;
  }

/**
 * Make a request to the Glia API with retry and caching capabilities
 * 
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Request options
 * @param {Object} requestOptions - Additional request options
 * @param {boolean} requestOptions.useCache - Whether to use cache for this request
 * @param {boolean} requestOptions.forceRefresh - Force a cache refresh
 * @param {number} requestOptions.cacheTtl - Custom TTL for this request
 * @param {boolean} requestOptions.useRetry - Whether to use retry for this request
 * @param {boolean} requestOptions.skipTokenRefresh - Skip the token refresh attempt on auth errors
 * @returns {Promise<Object>} - Response data
 * @throws {GliaError} - If the request fails
 */
  /**
   * Make a request to the Glia API with retry and caching capabilities
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @param {Object} requestOptions - Additional request options
   * @param {boolean} requestOptions.useCache - Whether to use cache for this request
   * @param {boolean} requestOptions.forceRefresh - Force a cache refresh
   * @param {number} requestOptions.cacheTtl - Custom TTL for this request
   * @param {boolean} requestOptions.useRetry - Whether to use retry for this request
   * @param {boolean} requestOptions.skipTokenRefresh - Skip the token refresh attempt on auth errors
   * @param {boolean} requestOptions.followRedirect - Whether to follow redirects (default true)
   * @param {number} requestOptions.maxRedirects - Maximum number of redirects to follow (default 5)
   * @returns {Promise<Object>} - Response data
   * @throws {GliaError} - If the request fails
   */
  async makeRequest(endpoint, options = {}, requestOptions = {}) {
    // Auto token refresh flag - prevent recursive token refresh
    const { 
      skipTokenRefresh = false,
      followRedirect = this.requestConfig?.followRedirect ?? true,
      maxRedirects = this.requestConfig?.maxRedirects ?? 5,
      _redirectCount = 0 // Internal tracking of redirect count
    } = requestOptions;
    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';
    
    // Generate a unique request ID for tracking
    const requestId = `${endpoint}::${this._generateRequestId()}`;
    
    // Add request timeout and handle cancellation
    const controller = new AbortController();
    if (options.signal) {
      // If there's already a signal, we need to handle both signals
      const existingSignal = options.signal;
      
      // If the original signal aborts, we need to abort our controller too
      const onAbort = () => {
        controller.abort();
        existingSignal.removeEventListener('abort', onAbort);
      };
      
      existingSignal.addEventListener('abort', onAbort);
    }
    
    // Add our controller's signal to the request
    options.signal = controller.signal;
    
    // Set up the timeout
    const timeout = requestOptions.timeout || this.requestConfig.defaultTimeout;
    const timeoutId = setTimeout(() => {
      controller.abort(new Error('Request timed out'));
    }, timeout);
    
    // Add this request to the active requests map for cancellation support
    this.activeRequests.set(requestId, controller);
    
    // Handle idempotency for mutation operations
    if (this.requestConfig.idempotencyEnabled && 
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) &&
        !options.headers?.[this.requestConfig.idempotencyHeader]) {
      
      // Add or update headers with idempotency key
      options.headers = {
        ...(options.headers || {}),
        [this.requestConfig.idempotencyHeader]: requestId
      };
    }
    
    // Request logging if enabled
    if (this.logRequests) {
      console.log(`[API] ${method} ${url} (${requestId})`);
    }
    
    // Store request info for error context
    const requestInfo = {
      endpoint,
      method,
      requestId,
      payload: this._extractPayload(options.body)
    };
    
    // Default request options
    const {
      useCache = true,
      forceRefresh = false,
      cacheTtl,
      useRetry = true,
      offlineMode = true,   // Whether to use offline capabilities
      isPrefetch = false    // Whether this is a prefetch request
    } = requestOptions;
    
    // Add debug info to request tracking
    const trackingInfo = {
      timestamp: new Date().toISOString(),
      cached: false,
      retries: 0,
      offline: false,
      isPrefetch
    };
    
    try {
      // Check if we're offline and have offline mode enabled
      let isOffline = false;
      if (offlineMode && this.offlineManager) {
        isOffline = await this.offlineManager.isOffline();
        trackingInfo.offline = isOffline;
        
        if (isOffline && this.logRequests) {
          console.log(`[API] Operating in offline mode`);
        }
      }
      
      // Check prefetch cache first if not a prefetch request itself
      if (!isPrefetch && this.requestConfig.prefetchEnabled) {
        const cacheKey = this._generateCacheKey(endpoint, options);
        const prefetched = this.prefetchCache.get(cacheKey);
        
        if (prefetched) {
          if (this.logRequests) {
            console.log(`[API] Prefetch hit for ${method} ${url}`);
          }
          
          // Clean up
          clearTimeout(timeoutId);
          this.activeRequests.delete(requestId);
          
          trackingInfo.cached = true;
          return prefetched.data;
        }
      }
      
      // Define the operation for offline queueing if needed
      const operation = {
        endpoint,
        options,
        requestOptions: {
          ...requestOptions,
          offlineMode: false // Don't recursively use offline mode when processing the queue
        }
      };
      
      // Check memory cache first if enabled and not forcing a refresh
      if (useCache && !forceRefresh && this._isMethodCacheable(method)) {
        const cachedResponse = this.cache.get(endpoint, options);
        if (cachedResponse) {
          if (this.logRequests) {
            console.log(`[API] Cache hit for ${method} ${url}`);
          }
          
          // Clean up
          clearTimeout(timeoutId);
          this.activeRequests.delete(requestId);
          
          trackingInfo.cached = true;
          return cachedResponse;
        }
        
        // If we're offline and have persistent cache, check it asynchronously
        if (isOffline && this.cache.config.persistent && this.cache.persistentCache) {
          try {
            const persistentData = await this.cache.getAsync(endpoint, options);
            if (persistentData) {
              if (this.logRequests) {
                console.log(`[API] Persistent cache hit for ${method} ${url}`);
              }
              
              // Clean up
              clearTimeout(timeoutId);
              this.activeRequests.delete(requestId);
              
              trackingInfo.cached = true;
              return persistentData;
            }
          } catch (error) {
            console.error('Error retrieving from persistent cache:', error);
          }
        }
      }
      
      // If we're offline, handle according to request type
      if (isOffline && offlineMode && this.offlineManager) {
        // Clean up
        clearTimeout(timeoutId);
        this.activeRequests.delete(requestId);
        
        return await this.offlineManager.executeOrQueue(
          // Function to execute when online
          () => this.makeRequest(endpoint, options, { ...requestOptions, offlineMode: false }),
          // Operation details for queueing
          operation
        );
      }
      
      // Execute the request function (with retry if enabled)
      const executeRequest = async () => {
        try {
          let requestOptions;
          
          // Special handling for FormData
          if (options.body instanceof FormData) {
            // Get content-type header with boundary from FormData
            const formHeaders = options.body.getHeaders();
            
            // Combine FormData headers with authorization headers
            const headers = {
              ...formHeaders,
              'Authorization': `Bearer ${this.bearerToken}`,
              'Accept': 'application/vnd.salemove.v1+json'
            };
            
            requestOptions = {
              ...options,
              headers // Use combined headers
            };
          } else {
            // Normal JSON request
            const headers = this._prepareHeaders(options.headers);
            requestOptions = {
              ...options,
              headers // Apply headers last to prevent them from being overridden
            };
          }
          
          const response = await fetch(url, requestOptions);
          
          // Extract and process response metadata
          const responseInfo = this._extractResponseMetadata(response);
          trackingInfo.requestId = responseInfo.requestId;
          
          // Parse response based on content type
          const data = await this._parseResponseData(response);
          
      // Handle rate limiting preemptively
      if (response.status === 429) {
        return this._handleRateLimit(response, responseInfo, requestInfo, data);
      }
      
      // Handle authentication errors specially to attempt token refresh
      if (response.status === 401 && !skipTokenRefresh) {
        // Try to refresh the token and retry the request
        const { refreshBearerTokenIfNeeded } = await import('./config.js');
        const refreshed = await refreshBearerTokenIfNeeded();
        
        if (refreshed) {
          console.log(`Token refreshed, retrying request to ${endpoint}...`);
          
          // Update the token in the current instance
          this.bearerToken = process.env.GLIA_BEARER_TOKEN;
          
          // Retry the request with the new token, but don't try to refresh again
          return this.makeRequest(endpoint, options, { 
            ...requestOptions, 
            skipTokenRefresh: true  // Prevent infinite retry loop
          });
        }
      }
      
      // Handle redirects
      if (followRedirect && 
          (response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308)) {
        
        // Check redirect count to prevent infinite loops
        if (_redirectCount >= maxRedirects) {
          throw new Error(`Maximum redirect count (${maxRedirects}) exceeded`);
        }
        
        // Debug logging for all response headers to troubleshoot
        console.log(`[API DEBUG] Got ${response.status} redirect response`);
        console.log('[API DEBUG] Response headers:');
        response.headers.forEach((value, key) => {
          console.log(`[API DEBUG] ${key}: ${value}`);
        });
        console.log('[API DEBUG] Response body:', JSON.stringify(data));
        
        // Try to get redirect URL from headers first
        let redirectUrl = response.headers.get('Location') || response.headers.get('location');
        
        // If no Location header but we have a 303 with data
        if (!redirectUrl && response.status === 303 && data) {
          console.log('[API DEBUG] No Location header found, examining response body');
          
          // Special case: If the response has 'status' field, it might be a task result already
          if (data.status && (data.status === 'completed' || data.status === 'failed')) {
            console.log(`[API DEBUG] Found task status in response body: ${data.status}`);
            // Return the data directly - it's a task result, not a redirect
            return data;
          }
          
          // Look for URLs in common fields - careful to avoid self-references
          const currentPath = new URL(url, 'https://example.com').pathname;
          
          // Check if any potential redirect URL is different from the current URL
          const extractUrl = (field, value) => {
            if (!value) return null;
            if (value === currentPath) {
              console.log(`[API DEBUG] Ignoring self-redirect in '${field}' field: ${value}`);
              return null;
            }
            console.log(`[API DEBUG] Found URL in '${field}' field: ${value}`);
            return value;
          };
          
          redirectUrl = extractUrl('entity.href', data.entity?.href) || 
                       extractUrl('entity.url', data.entity?.url) || 
                       extractUrl('url', data.url) || 
                       extractUrl('href', data.href);
          
          // Last resort, try self but explicitly check for self-redirect
          if (!redirectUrl && data.self && data.self !== currentPath) {
            redirectUrl = data.self;
            console.log(`[API DEBUG] Found URL in 'self' field: ${redirectUrl}`);
          }
          
          // If we still have no redirect URL but have a full task response,
          // return the data directly instead of trying to redirect
          if (!redirectUrl && data.entity && data.status) {
            console.log('[API DEBUG] No valid redirect URL found but response contains task data, using directly');
            return data;
          }
        }
        
        if (redirectUrl) {
          if (this.logRequests) {
            console.log(`[API] Following ${response.status} redirect to: ${redirectUrl}`);
          }
          
          // Determine the request method for the redirect
          // For 303, always use GET
          // For 301/302, traditionally browsers convert to GET (though specs have evolved)
          // For 307/308, preserve the original method
          let redirectMethod = method;
          if (response.status === 303 || response.status === 301 || response.status === 302) {
            redirectMethod = 'GET';
          }
          
          return this.makeRequest(redirectUrl, {
            ...options,
            method: redirectMethod,
            // Don't forward the body for GET requests
            body: redirectMethod === 'GET' ? undefined : options.body
          }, {
            ...requestOptions,
            _redirectCount: _redirectCount + 1
          });
        }
      }
      
      // Handle unsuccessful responses with more context
      if (!response.ok) {
        throw GliaError.fromApiResponse(response, data, {
          ...requestInfo, 
          requestTimestamp: trackingInfo.timestamp
        });
      }
          
          // Cache successful responses if appropriate
          if (useCache && this._isMethodCacheable(method)) {
            // Store in memory cache
            this.cache.set(endpoint, options, data, cacheTtl);
            
            // Also store in persistent cache if enabled
            if (this.cache.config.persistent && this.offlineManager) {
              try {
                await this.offlineManager.saveToCache(endpoint, options, data, cacheTtl);
              } catch (error) {
                console.error('Error saving to persistent cache:', error);
              }
            }
          }
          
          return data;
        } catch (error) {
          return this._handleRequestError(error, endpoint, requestInfo, trackingInfo);
        }
      };
    
      // If retry is disabled, just execute the request once
      let result;
      try {
        if (!useRetry) {
          result = await executeRequest();
        } else {
          // Otherwise, use retry mechanism
          result = await withRetry(
            executeRequest,
            {
              retryConfig: this.retryConfig,
              circuitBreaker: this.circuitBreaker,
              onRetry: (retryInfo) => {
                trackingInfo.retries = retryInfo.attempt;
                if (this.logRequests) {
                  console.log(`[API] Retrying ${method} ${url} (attempt ${retryInfo.attempt}, delay ${retryInfo.delayMs}ms)`);
                }
              },
              context: {
                endpoint,
                method,
                tracking: trackingInfo,
                requestId
              }
            }
          );
        }
        
        // Clean up
        clearTimeout(timeoutId);
        this.activeRequests.delete(requestId);
        
        // Schedule background prefetching for certain GET requests if enabled
        if (this.requestConfig.prefetchEnabled && 
            method.toUpperCase() === 'GET' &&
            !isPrefetch &&
            result) {
          
          // Check if the result has links to prefetch
          this._schedulePrefetching(result, endpoint);
        }
        
        return result;
      } catch (error) {
        // Clean up on error
        clearTimeout(timeoutId);
        this.activeRequests.delete(requestId);
        throw error;
      }
    } catch (outerError) {
      // Handle errors from the try/catch block (like offline errors)
      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);
      throw outerError;
    }
  }
  
  /**
   * Schedule prefetching for linked resources if appropriate
   * 
   * @param {Object} result - The API response
   * @param {string} sourceEndpoint - The endpoint that was requested
   * @private
   */
  _schedulePrefetching(result, sourceEndpoint) {
    if (!this.requestConfig.prefetchEnabled || !result) {
      return;
    }
    
    try {
      // Don't prefetch if this is a list endpoint
      if (sourceEndpoint.includes('list') || 
          sourceEndpoint.match(/\/\w+s\??/)) { // Endpoint ends with plural name
        return;
      }
      
      // Look for common patterns for linked resources
      const prefetchEndpoints = [];
      
      // Look for IDs that could be related resources
      if (result.id) {
        // Example: if we loaded /functions/123, prefetch /functions/123/versions
        if (sourceEndpoint.match(/\/functions\/[^\/]+$/)) {
          prefetchEndpoints.push(`${sourceEndpoint}/versions`);
        }
        
        // Example: if we loaded /functions/123, prefetch /functions/123/logs
        if (sourceEndpoint.match(/\/functions\/[^\/]+$/)) {
          prefetchEndpoints.push(`${sourceEndpoint}/logs`);
        }
      }
      
      // Schedule the prefetches with a small delay to not block current request
      for (const endpoint of prefetchEndpoints) {
        setTimeout(() => {
          this.prefetch(endpoint);
        }, 100);
      }
    } catch (error) {
      // Silent fail for prefetch scheduling - just log if enabled
      if (this.logRequests) {
        console.log(`[API] Prefetch scheduling failed:`, error.message);
      }
    }
  }
  
  /**
   * Extract and normalize payload from request body
   * @private
   */
  _extractPayload(body) {
    if (!body) return null;
    
    // If it's already a string, try to parse it as JSON
    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch (e) {
        return body; // Keep as string if not valid JSON
      }
    }
    
    return body; // Return as is (object)
  }
  
  /**
   * Check if HTTP method is cacheable
   * @private
   */
  _isMethodCacheable(method) {
    return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  }
  
  /**
   * Prepare request headers with auth and defaults
   * @private
   */
  _prepareHeaders(customHeaders = {}) {
    // If Content-Type is already set in customHeaders, don't override it
    // This ensures FormData can set its own Content-Type with boundary
    const contentType = customHeaders['Content-Type'] || 'application/json';
    
    return {
      'Authorization': `Bearer ${this.bearerToken}`,
      'Content-Type': contentType,
      'Accept': 'application/vnd.salemove.v1+json',
      'User-Agent': 'GliaFunctionsCLI/1.0',
      ...customHeaders
    };
  }
  
  /**
   * Extract useful metadata from response
   * @private
   */
  _extractResponseMetadata(response) {
    const requestId = response.headers.get('x-request-id') || 
                     response.headers.get('request-id');
    
    const rateLimit = {
      limit: response.headers.get('x-rate-limit-limit'),
      remaining: response.headers.get('x-rate-limit-remaining'),
      reset: response.headers.get('x-rate-limit-reset'),
      retryAfter: response.headers.get('retry-after')
    };
    
    // Parse numeric values
    if (rateLimit.limit) rateLimit.limit = parseInt(rateLimit.limit, 10);
    if (rateLimit.remaining) rateLimit.remaining = parseInt(rateLimit.remaining, 10);
    if (rateLimit.reset) rateLimit.reset = parseInt(rateLimit.reset, 10) * 1000;
    if (rateLimit.retryAfter) rateLimit.retryAfter = parseInt(rateLimit.retryAfter, 10);
    
    return {
      requestId,
      rateLimit,
      statusCode: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries([...response.headers.entries()])
    };
  }
  
  /**
   * Parse response data based on content type
   * @private
   */
  async _parseResponseData(response) {
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      // Handle other content types specifically if needed
      if (contentType && contentType.includes('text/plain')) {
        return await response.text();
      }
      
      // Default fallback
      return await response.text();
    } catch (parseError) {
      // Enhanced error context
      throw GliaError.fromError(
        parseError,
        'Failed to parse API response',
        { 
          statusCode: response.status,
          contentType,
          responseSize: response.headers.get('content-length')
        }
      );
    }
  }
  
  /**
   * Handle rate limit error with detailed context
   * @private
   */
  _handleRateLimit(response, responseInfo, requestInfo, data) {
    const { rateLimit, requestId } = responseInfo;
    
    throw new RateLimitError(
      `Rate limit exceeded. Retry after ${rateLimit.retryAfter || 'unknown'} seconds`,
      { 
        endpoint: requestInfo.endpoint, 
        method: requestInfo.method,
        limitDetails: rateLimit
      },
      {
        statusCode: 429,
        retryAfter: rateLimit.retryAfter,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        reset: rateLimit.reset,
        endpoint: requestInfo.endpoint,
        method: requestInfo.method,
        requestId,
        responseBody: data
      }
    );
  }
  
  /**
   * Handle and enhance request errors
   * @private
   */
  _handleRequestError(error, endpoint, requestInfo, trackingInfo) {
    // If it's already a GliaError, add additional tracking context
    if (error instanceof GliaError) {
      // Enrich with tracking info before rethrowing
      error.tracking = trackingInfo;
      throw error;
    }
    
    // Enhanced context for network errors
    const context = {
      ...requestInfo,
      tracking: trackingInfo,
      timestamp: new Date().toISOString()
    };
    
    // Create enriched error with detailed context
    throw GliaError.fromError(
      error, 
      `API request to ${endpoint} failed`,
      context
    );
  }
  
  /**
   * Invalidate cache entries by pattern
   * 
   * @param {string|RegExp} pattern - Pattern to match against endpoints
   */
  invalidateCache(pattern) {
    this.cache.invalidatePattern(pattern);
  }
  
  /**
   * Clear the entire response cache
   */
  clearCache() {
    this.cache.clear();
  }
  
  /**
   * Enable or disable response caching
   * 
   * @param {boolean} enabled - Whether to enable caching
   */
  setCaching(enabled) {
    this.cache.setEnabled(enabled);
  }
  
  /**
   * List all functions for the site
   * 
   * @param {Object} options - Request options
   * @param {boolean} options.forceRefresh - Force a cache refresh
   * @returns {Promise<Object>} - Functions list response
   */
  async listFunctions(options = {}) {
    try {
      // Using the correct endpoint from the OpenAPI spec
      const endpoint = `/functions?site_ids[]=${this.siteId}`;
      return await this.makeRequest(endpoint, {}, {
        forceRefresh: options.forceRefresh
      });
    } catch (error) {
      const errorContext = {
        operation: 'listFunctions',
        siteId: this.siteId
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to list functions: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to list functions: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Get details of a specific function
   * 
   * @param {string} functionId - Function ID
   * @param {Object} options - Request options
   * @param {boolean} options.forceRefresh - Force a cache refresh
   * @returns {Promise<Object>} - Function details
   */
  async getFunction(functionId, options = {}) {
    try {
      validateFunctionId(functionId);
      
      // Using the correct endpoint from the OpenAPI spec
      const endpoint = `/functions/${functionId}`;
      return await this.makeRequest(endpoint, {}, {
        forceRefresh: options.forceRefresh
      });
    } catch (error) {
      const errorContext = {
        operation: 'getFunction',
        siteId: this.siteId,
        functionId
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to get function: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to get function: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Create a new function
   *
   * @param {string} name - Function name
   * @param {string} description - Function description
   * @param {Object} options - Additional options
   * @param {number} [options.warmInstances] - Number of warm instances (0-5)
   * @returns {Promise<Object>} - Created function details
   */
  async createFunction(name, description = '', options = {}) {
    try {
      validateFunctionName(name);

      const payload = {
        name,
        description,
        site_id: this.siteId
      };

      // Add warm_instances if provided and valid
      if (options.warmInstances !== undefined) {
        const warmInstances = parseInt(options.warmInstances, 10);
        if (isNaN(warmInstances) || warmInstances < 0 || warmInstances > 5) {
          throw new ValidationError('warm_instances must be a number between 0 and 5');
        }
        payload.warm_instances = warmInstances;
      }

      // Using the correct endpoint from the OpenAPI spec
      const endpoint = `/functions`;
      return await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (error) {
      const errorContext = {
        operation: 'createFunction',
        siteId: this.siteId,
        functionName: name
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to create function: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to create function: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Create a new function version
   * 
   * @param {string} functionId - Function ID
   * @param {string} code - Function code
   * @param {Object} options - Version options
   * @param {string} options.compatibilityDate - Workerd compatibility date
   * @param {Object} options.environmentVariables - Environment variables
   * @returns {Promise<Object>} - Task details to check the version creation status
   */
  async createVersion(functionId, code, options = {}) {
    try {
      validateFunctionId(functionId);
      
      // Using the correct endpoint from the OpenAPI spec
      const endpoint = `/functions/${functionId}/versions`;
      
      const payload = {
        code: code // API expects 'code' not 'code_bundle'
      };
      
      if (options.compatibilityDate) {
        payload.compatibility_date = options.compatibilityDate;
      }
      
      if (options.environmentVariables) {
        payload.environment_variables = options.environmentVariables;
      }
      
      // According to the OpenAPI spec, this returns a 202 with a task to poll
      return await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (error) {
      const errorContext = {
        operation: 'createVersion',
        siteId: this.siteId,
        functionId,
        compatibilityDate: options.compatibilityDate,
        hasEnvVars: options.environmentVariables ? true : false,
        codeSize: code ? code.length : 0
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to create function version: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to create function version: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Update an existing function version (creates a new version based on existing one)
   * 
   * @param {string} functionId - Function ID
   * @param {string} versionId - Base version ID
   * @param {Object} options - Version options
   * @param {string} [options.code] - New function code (optional)
   * @param {string} [options.compatibilityDate] - Workerd compatibility date
   * @param {Object} [options.environmentVariables] - Environment variables
   * @returns {Promise<Object>} - Task details to check the version creation status
   */
  async updateVersion(functionId, versionId, options = {}) {
    try {
      validateFunctionId(functionId);
      
      if (!versionId) {
        throw new ValidationError('Version ID is required', { field: 'versionId' }, {});
      }
      
      // Using the PATCH endpoint from the OpenAPI spec
      const endpoint = `/functions/${functionId}/versions/${versionId}`;
      
      const payload = {};
      
      // At least one of code or environment_variables must be present
      if (options.code) {
        payload.code = options.code;
      }
      
      if (options.compatibilityDate) {
        payload.compatibility_date = options.compatibilityDate;
      }
      
      if (options.environmentVariables) {
        payload.environment_variables = options.environmentVariables;
      }
      
      // Validate that at least code or environment_variables is provided
      if (!options.code && !options.environmentVariables) {
        throw new ValidationError(
          'At least one of code or environmentVariables must be provided', 
          { field: 'options' }, 
          {}
        );
      }
      
      // According to the OpenAPI spec, this returns a 202 with a task to poll
      return await this.makeRequest(endpoint, {
        method: 'PATCH',
        headers: this._prepareHeaders(),
        body: JSON.stringify(payload)
      });
    } catch (error) {
      const errorContext = {
        operation: 'updateVersion',
        siteId: this.siteId,
        functionId,
        versionId,
        compatibilityDate: options.compatibilityDate,
        hasEnvVars: options.environmentVariables ? true : false,
        hasCode: options.code ? true : false
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to update function version: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to update function version: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Fetch the status of a version creation task
   * 
   * @param {string} functionId - Function ID
   * @param {string} taskId - Task ID returned from createVersion
   * @returns {Promise<Object>} - Task status and created version if completed
   */
  async getVersionCreationTask(functionId, taskId) {
    try {
      validateFunctionId(functionId);
      
      if (!taskId) {
        throw new ValidationError('Task ID is required', { field: 'taskId' }, {});
      }
      
      const endpoint = `/functions/${functionId}/tasks/${taskId}`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      const errorContext = {
        operation: 'getVersionCreationTask',
        siteId: this.siteId,
        functionId,
        taskId
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to get version creation task: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to get version creation task: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Fetch the code of a specific function version
   * 
   * @param {string} functionId - Function ID
   * @param {string} versionId - Version ID
   * @returns {Promise<string>} - Function code
   */
  async getVersionCode(functionId, versionId) {
    try {
      validateFunctionId(functionId);
      
      if (!versionId) {
        throw new ValidationError('Version ID is required', { field: 'versionId' }, {});
      }
      
      const endpoint = `/functions/${functionId}/versions/${versionId}/code`;
      
      // Override headers to accept text/plain for code
      const options = {
        headers: {
          'Accept': 'text/plain'
        }
      };
      
      return await this.makeRequest(endpoint, options);
    } catch (error) {
      const errorContext = {
        operation: 'getVersionCode',
        siteId: this.siteId,
        functionId,
        versionId
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to get function version code: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to get function version code: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Change the current version of a function
   * 
   * @param {string} functionId - Function ID
   * @param {string} versionId - Version ID
   * @returns {Promise<Object>} - Deployment response with invocation_uri
   */
  async deployVersion(functionId, versionId) {
    try {
      validateFunctionId(functionId);
      
      if (!versionId) {
        throw new ValidationError('Version ID is required', { field: 'versionId' }, {});
      }
      
      // Using the correct endpoint from the OpenAPI spec
      const endpoint = `/functions/${functionId}/deployments`;
      return await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ version_id: versionId }) // Pass version_id in body
      });
    } catch (error) {
      const errorContext = {
        operation: 'deployVersion',
        siteId: this.siteId,
        functionId,
        versionId
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to deploy function version: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to deploy function version: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * List versions for a function
   * 
   * @param {string} functionId - Function ID
   * @returns {Promise<Object>} - Versions list response
   */
  async listVersions(functionId) {
    try {
      validateFunctionId(functionId);
      
      // Using the correct endpoint from the OpenAPI spec
      const endpoint = `/functions/${functionId}/versions`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      const errorContext = {
        operation: 'listVersions',
        siteId: this.siteId,
        functionId
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to list function versions: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to list function versions: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Get details of a specific function version
   * 
   * @param {string} functionId - Function ID
   * @param {string} versionId - Version ID
   * @returns {Promise<Object>} - Version details
   */
  async getVersion(functionId, versionId) {
    try {
      validateFunctionId(functionId);
      
      if (!versionId) {
        throw new ValidationError('Version ID is required', { field: 'versionId' }, {});
      }
      
      // Using the correct endpoint from the OpenAPI spec
      const endpoint = `/functions/${functionId}/versions/${versionId}`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      const errorContext = {
        operation: 'getVersion',
        siteId: this.siteId,
        functionId,
        versionId
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to get function version: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to get function version: ${error.message}`, errorContext);
      }
    }
  }

  /**
   * Get environment variables from a function version
   * 
   * @param {string} functionId - Function ID
   * @param {string} versionId - Version ID
   * @returns {Promise<Object>} - Environment variables for the function version (keys only)
   */
  async getVersionEnvVars(functionId, versionId) {
    try {
      validateFunctionId(functionId);
      
      if (!versionId) {
        throw new ValidationError('Version ID is required', { field: 'versionId' }, {});
      }
      
      // First get version details to get the list of defined environment variables
      const version = await this.getVersion(functionId, versionId);
      
      if (!version.defined_environment_variables || version.defined_environment_variables.length === 0) {
        return {}; // No environment variables defined
      }
      
      // Return defined environment variables as an object with placeholder values
      // Note: The actual values can't be fetched from the API for security reasons
      const envVars = {};
      version.defined_environment_variables.forEach(key => {
        envVars[key] = '********'; // Placeholder for secured variables
      });
      
      return envVars;
    } catch (error) {
      const errorContext = {
        operation: 'getVersionEnvVars',
        siteId: this.siteId,
        functionId,
        versionId
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to get function version environment variables: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to get function version environment variables: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Update environment variables for a function
   * Creates a new version based on an existing one with updated environment variables
   * 
   * @param {string} functionId - Function ID
   * @param {string} versionId - Current version ID to base new version on
   * @param {Object} environmentVariables - Environment variables to update
   * @param {boolean} [deploy=true] - Whether to deploy the new version automatically
   * @returns {Promise<Object>} - Task details and version information
   */
  async updateEnvVars(functionId, versionId, environmentVariables, deploy = true) {
    try {
      validateFunctionId(functionId);
      
      if (!versionId) {
        throw new ValidationError('Version ID is required', { field: 'versionId' }, {});
      }
      
      if (!environmentVariables || Object.keys(environmentVariables).length === 0) {
        throw new ValidationError('Environment variables are required', { field: 'environmentVariables' }, {});
      }
      
      // Create a new version based on the current version with updated environment variables
      const updateTask = await this.updateVersion(functionId, versionId, { 
        environmentVariables
      });
      
      // If we're not deploying, return the task info
      if (!deploy) {
        return updateTask;
      }
      
      // Poll for task completion to get the new version ID
      const taskId = updateTask.self.split('/').pop();
      let taskStatus = null;
      let attempts = 0;
      const maxAttempts = 120; // Maximum polling attempts (120 seconds = 2 minutes)
      const pollInterval = 1000; // Poll every 1 second

      // Show progress indicator
      process.stdout.write('Creating new version');

      while (attempts < maxAttempts) {
        taskStatus = await this.getVersionCreationTask(functionId, taskId);

        if (taskStatus.status === 'completed') {
          // Clear progress dots and show success
          process.stdout.write(' ✓\n');

          // Deploy the new version
          process.stdout.write('Deploying new version');
          await this.deployVersion(functionId, taskStatus.entity.id);
          process.stdout.write(' ✓\n');

          // Return the full task status including the newly created version ID
          return {
            ...taskStatus,
            deployed: true,
            message: 'Environment variables updated and new version deployed successfully'
          };
        } else if (taskStatus.status === 'failed') {
          process.stdout.write(' ✗\n');
          throw new Error('Version creation failed: ' + (taskStatus.error || 'Unknown error'));
        }

        // Show progress dot every 2 seconds
        if (attempts % 2 === 0) {
          process.stdout.write('.');
        }

        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
      }

      process.stdout.write(' ✗\n');
      throw new Error(`Timed out waiting for version creation to complete after ${maxAttempts} seconds`);
    } catch (error) {
      const errorContext = {
        operation: 'updateEnvVars',
        siteId: this.siteId,
        functionId,
        versionId,
        envVarsCount: environmentVariables ? Object.keys(environmentVariables).length : 0
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to update environment variables: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to update environment variables: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Invoke a function
   * 
   * @param {string} invocationUri - Function invocation URI
   * @param {string|Object} payload - Function payload
   * @returns {Promise<Object>} - Function response
   */
  async invokeFunction(invocationUri, payload = {}) {
    try {
      if (!invocationUri) {
        throw new ValidationError('Invocation URI is required', { field: 'invocationUri' }, {});
      }
      
      let stringifiedPayload;
      try {
        stringifiedPayload = typeof payload === 'string'
          ? payload
          : JSON.stringify(payload);
      } catch (error) {
        throw new ValidationError(
          `Invalid payload: ${error.message}`, 
          { field: 'payload', provided: payload },
          {}
        );
      }
      
      // For invoke function, we don't prepend baseUrl
      const fullUrl = invocationUri.startsWith('http') ? invocationUri : this.baseUrl + invocationUri;
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.salemove.v1+json'
        },
        body: stringifiedPayload
      };
      
      const response = await fetch(fullUrl, fetchOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw GliaError.fromApiResponse(response, errorData, {
          endpoint: invocationUri,
          method: 'POST',
          payload: payload
        });
      }
      
      // Parse response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      const errorContext = {
        operation: 'invokeFunction',
        invocationUri,
        payloadSize: typeof payload === 'string' ? payload.length : JSON.stringify(payload).length
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to invoke function: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint || invocationUri,
            method: 'POST',
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload || payload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to invoke function: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Get function logs
   * 
   * @param {string} functionId - Function ID
   * @param {Object} options - Logs options
   * @param {number} options.limit - Max number of logs to return
   * @param {string} options.startTime - Start time for logs
   * @param {string} options.endTime - End time for logs
   * @returns {Promise<Object>} - Logs response
   */
  async getFunctionLogs(functionId, options = {}) {
    try {
      validateFunctionId(functionId);
      
      // Using the correct endpoint from the OpenAPI spec
      const endpoint = `/functions/${functionId}/logs`;
      
      const queryParams = [];
      if (options.limit) {
        queryParams.push(`per_page=${options.limit}`); // API expects 'per_page' not 'limit'
      }
      if (options.startTime) {
        queryParams.push(`from=${options.startTime}`); // API expects 'from' not 'start_time'
      }
      if (options.endTime) {
        queryParams.push(`to=${options.endTime}`); // API expects 'to' not 'end_time'
      }
      
      const queryString = queryParams.length > 0
        ? `?${queryParams.join('&')}`
        : '';
      
      return await this.makeRequest(`${endpoint}${queryString}`);
    } catch (error) {
      const errorContext = {
        operation: 'getFunctionLogs',
        siteId: this.siteId,
        functionId,
        limit: options.limit,
        startTime: options.startTime,
        endTime: options.endTime
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to get function logs: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to get function logs: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Process queued operations from offline mode
   * 
   * @returns {Promise<Array>} - Results of processed operations
   * @throws {NetworkError} - If still offline
   */
  async processOfflineQueue() {
    if (!this.offlineManager) {
      return [];
    }
    
    return await this.offlineManager.processQueue(async (operation) => {
      // Extract operation details
      const { endpoint, options, requestOptions } = operation;
      
      // Execute the operation with offline mode disabled
      return await this.makeRequest(
        endpoint, 
        options, 
        { ...requestOptions, offlineMode: false }
      );
    });
  }
  
  /**
   * Check if the client is currently offline
   * 
   * @returns {Promise<boolean>} - Whether the client is offline
   */
  async isOffline() {
    if (!this.offlineManager) {
      return false;
    }
    
    return await this.offlineManager.isOffline();
  }
  
  /**
   * List applets
   * 
   * Note on API response formats:
   * - The Glia API has two endpoints for listing applets with different permissions:
   *   1. `/sites/{site_id}/axons` - Requires applets:read permission
   *   2. `/axons?site_id={site_id}` - Requires list:applets permission
   * 
   * These endpoints can return responses in different formats:
   * - `/sites/{site_id}/axons` returns { axons: [...] }
   * - `/axons?site_id={site_id}` might return { items: [...] }
   * 
   * This method normalizes these responses to always return { axons: [...] }
   * for consistency throughout the application.
   * 
   * @param {Object} options - Request options
   * @param {string} options.siteId - Filter by site ID
   * @param {string} options.scope - Filter by scope (engagement, global)
   * @returns {Promise<Object>} - Applets list response in format { axons: [...] }
   */
  async listApplets(options = {}) {
    try {
      const queryParams = [];
      
      // Use current site ID if not specified
      const siteId = options.siteId || this.siteId;

      if (!siteId) {
        throw new Error('Missing site ID. Please set a site ID using the CLI or specify it in the request options.');
      }
      
      // Try site-specific endpoint first (requires applets:read permission)
      try {
        // Use site-specific endpoint to fetch applets
        const endpoint = `/sites/${siteId}/axons`;

        // Add scope as query param if specified
        if (options.scope) {
          queryParams.push(`scope=${options.scope}`);
        }

        const fullEndpoint = `${queryParams.length > 0 ? `${endpoint}?${queryParams.join('&')}` : endpoint}`;
        const result = await this.makeRequest(fullEndpoint);

        // Normalize response to expected format
        if (result && !result.axons && Array.isArray(result.items)) {
          return { axons: result.items };
        }

        return result;
      } catch (firstError) {
        // If we get a 403, try the alternative endpoint
        if (firstError.statusCode === 403) {
          // Try alternative endpoint (requires list:applets permission)
          const altQueryParams = [];

          // Add site_id as query param
          altQueryParams.push(`site_id=${siteId}`);

          // Add scope if specified
          if (options.scope) {
            altQueryParams.push(`scope=${options.scope}`);
          }

          const altEndpoint = `/axons?${altQueryParams.join('&')}`;
          const result = await this.makeRequest(altEndpoint);

          // Normalize response to expected format
          if (result && !result.axons && Array.isArray(result.items)) {
            return { axons: result.items };
          }

          return result;
        } else {
          throw firstError;
        }
      }
    } catch (error) {
      const errorContext = {
        operation: 'listApplets',
        siteId: this.siteId,
        options
      };
      
      throw this._createError('Failed to list applets', error, errorContext);
    }
  }
  
  /**
   * Get applet details
   * 
   * @param {string} appletId - Applet ID
   * @returns {Promise<Object>} - Applet details
   */
  async getApplet(appletId) {
    try {
      return await this.makeRequest(`/axons/${appletId}`);
    } catch (error) {
      const errorContext = {
        operation: 'getApplet',
        appletId
      };
      
      throw this._createError('Failed to get applet', error, errorContext);
    }
  }
  
  /**
   * Create an applet
   * 
   * @param {Object} options - Applet options
   * @param {string} options.name - Applet name
   * @param {string} options.description - Applet description
   * @param {string} options.ownerSiteId - Owner site ID
   * @param {string} options.source - HTML content for hosted applet
   * @param {string} options.sourceUrl - URL for external applet
   * @param {string} options.scope - Applet scope (engagement or global)
   * @returns {Promise<Object>} - Created applet response
   */
  async createApplet(options) {
    try {
      if (!options.name) {
        throw new Error('Applet name is required');
      }
      
      if (!options.ownerSiteId) {
        throw new Error('Owner site ID is required');
      }
      
      if (!options.source && !options.sourceUrl) {
        throw new Error('Either source or sourceUrl is required');
      }
      
      // Prepare FormData for multipart request using form-data package (Node.js)
      if (DEBUG_API) console.log('[API DEBUG] Creating FormData for applet request');
      
      const formData = new FormData();
      
      // Add required fields
      formData.append('name', options.name);
      formData.append('owner_site_id', options.ownerSiteId);
      
      // Add optional fields
      if (options.description) {
        formData.append('description', options.description);
      }
      
      if (options.scope) {
        formData.append('scope', options.scope);
      }
      
      // Add source content or source URL
      if (options.source) {
        // For Node.js FormData, use a Buffer
        const buffer = Buffer.from(options.source, 'utf8');
        formData.append('source', buffer, {
          filename: 'applet.html',
          contentType: 'text/html'
        });
        
        if (DEBUG_API) console.log(`[API DEBUG] Added source content as buffer (${buffer.length} bytes)`);
      } else if (options.sourceUrl) {
        formData.append('source_url', options.sourceUrl);
        if (DEBUG_API) console.log(`[API DEBUG] Added source_url: ${options.sourceUrl}`);
      }
      
      // Debug the form-data contents
      if (DEBUG_API) {
        console.log('[API DEBUG] FormData headers:');
        const headers = formData.getHeaders();
        Object.keys(headers).forEach(key => {
          console.log(`[API DEBUG] ${key}: ${headers[key]}`);
        });
      }
      
      // REMOVED DUPLICATE FORMDATA CODE
      
      // Make the request with FormData
      // We'll use native node-fetch capabilities to send this request
      // to ensure compatibility with the API endpoint
      
      if (DEBUG_API) {
        console.log('[API DEBUG] Setting up direct fetch with node-fetch + form-data');
        // Some FormData implementations might have getBuffer() as async or requiring callback
        // Avoid calling it directly to prevent callback errors
        console.log('[API DEBUG] FormData created and ready to send');
      }
      
      // Instead of using makeRequest, make a direct fetch call
      const fullUrl = `${this.baseUrl}/axons`;
      
      if (DEBUG_API) {
        console.log(`[API DEBUG] Making direct fetch to: ${fullUrl}`);
      }
      
      // Get content-type with boundary from form-data but set auth headers manually
      const formHeaders = formData.getHeaders();
      
      // Create headers object with the correct content-type from formData
      // but also including auth and accept headers
      const headers = {
        ...formHeaders,
        'Authorization': `Bearer ${this.bearerToken}`,
        'Accept': 'application/vnd.salemove.v1+json' // Required by the API
      };
      
      // Make the request with proper headers
      const response = await fetch(fullUrl, {
        method: 'POST',
        body: formData,
        headers: headers
      });
      
      // Handle the response
      if (DEBUG_API) {
        console.log(`[API DEBUG] Response status: ${response.status}`);
        console.log(`[API DEBUG] Response headers:`);
        response.headers.forEach((value, name) => {
          console.log(`[API DEBUG] ${name}: ${value}`);
        });
      }
      
      // Extract the response data
      let responseData;
      try {
        // Try to parse response as JSON
        responseData = await response.json();
        if (DEBUG_API) {
          console.log('[API DEBUG] Response body:', JSON.stringify(responseData));
        }
      } catch (error) {
        // If response is not JSON
        const text = await response.text();
        if (DEBUG_API) {
          console.log('[API DEBUG] Non-JSON response:', text);
        }
        
        if (!response.ok) {
          throw new Error(`Failed to create applet: ${text || response.statusText}`);
        }
        
        // Try to extract ID from HTML or other response if needed
        responseData = { message: 'Success', text };
      }
      
      if (!response.ok) {
        throw new Error(`Failed to create applet: ${JSON.stringify(responseData)}`);
      }
      
      return responseData;
    } catch (error) {
      const errorContext = {
        operation: 'createApplet',
        siteId: this.siteId,
        options: { 
          ...options,
          // Don't include the source content in the error to avoid polluting logs
          source: options.source ? '[Content omitted]' : undefined
        }
      };
      
      throw this._createError('Failed to create applet', error, errorContext);
    }
  }
  
  /**
   * Update an applet
   * 
   * @param {string} appletId - Applet ID
   * @param {Object} options - Update options
   * @param {string} options.name - New applet name
   * @param {string} options.description - New applet description
   * @param {string} options.source - New HTML content
   * @param {string} options.sourceUrl - New external URL
   * @param {string} options.scope - New applet scope
   * @returns {Promise<Object>} - Updated applet response
   */
  async updateApplet(appletId, options) {
    try {
      if (!appletId) {
        throw new Error('Applet ID is required');
      }
      
      // Prepare FormData for multipart request
      const formData = new FormData();
      
      // Add update fields
      if (options.name) {
        formData.append('name', options.name);
      }
      
      if (options.description !== undefined) {
        formData.append('description', options.description);
      }
      
      if (options.scope) {
        formData.append('scope', options.scope);
      }
      
      // Add source (HTML content) or source_url (external URL)
      if (options.source) {
        // For Node.js FormData, use a Buffer instead of Blob
        const buffer = Buffer.from(options.source, 'utf8');
        formData.append('source', buffer, {
          filename: 'applet.html',
          contentType: 'text/html'
        });
      } else if (options.sourceUrl) {
        formData.append('source_url', options.sourceUrl);
      }
      
      // Make the request
      // Get content-type with boundary from form-data but set auth headers manually
      const formHeaders = formData.getHeaders();
      
      // Create headers object with the correct content-type from formData
      // but also including auth and accept headers
      const headers = {
        ...formHeaders,
        'Authorization': `Bearer ${this.bearerToken}`,
        'Accept': 'application/vnd.salemove.v1+json' // Required by the API
      };
      
      // Create request options with proper headers
      const requestOptions = {
        method: 'PATCH',
        body: formData,
        headers: headers
      };
      
      return await this.makeRequest(`/axons/${appletId}`, requestOptions);
    } catch (error) {
      const errorContext = {
        operation: 'updateApplet',
        appletId,
        options: { 
          ...options,
          // Don't include the source content in the error to avoid polluting logs
          source: options.source ? '[Content omitted]' : undefined
        }
      };
      
      throw this._createError('Failed to update applet', error, errorContext);
    }
  }
  
  /**
   * Delete an applet
   * 
   * @param {string} appletId - Applet ID
   * @returns {Promise<void>}
   */
  async deleteApplet(appletId) {
    try {
      if (!appletId) {
        throw new Error('Applet ID is required');
      }
      
      return await this.makeRequest(`/axons/${appletId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      const errorContext = {
        operation: 'deleteApplet',
        appletId
      };
      
      throw this._createError('Failed to delete applet', error, errorContext);
    }
  }
  
  /**
   * Add an applet to a site
   * 
   * @param {string} siteId - Site ID
   * @param {string} appletId - Applet ID
   * @returns {Promise<Object>} - Response
   */
  async addAppletToSite(siteId, appletId) {
    try {
      if (!siteId) {
        throw new Error('Site ID is required');
      }
      
      if (!appletId) {
        throw new Error('Applet ID is required');
      }
      
      return await this.makeRequest(`/sites/${siteId}/axons`, {
        method: 'POST',
        body: JSON.stringify({
          axon_id: appletId
        })
      });
    } catch (error) {
      const errorContext = {
        operation: 'addAppletToSite',
        siteId,
        appletId
      };
      
      throw this._createError('Failed to add applet to site', error, errorContext);
    }
  }
  
  /**
   * List applets for a site
   * 
   * @param {string} siteId - Site ID
   * @param {Object} options - Request options
   * @param {string} options.scope - Filter by scope (engagement, global)
   * @returns {Promise<Object>} - Site applets response
   */
  async listSiteApplets(siteId, options = {}) {
    try {
      if (!siteId) {
        throw new Error('Site ID is required');
      }
      
      const queryParams = [];
      
      if (options.scope) {
        queryParams.push(`scope=${options.scope}`);
      }
      
      const endpoint = `/sites/${siteId}/axons${queryParams.length > 0 ? '?' + queryParams.join('&') : ''}`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      const errorContext = {
        operation: 'listSiteApplets',
        siteId,
        options
      };
      
      throw this._createError('Failed to list site applets', error, errorContext);
    }
  }
  
  /**
   * Helper method to create consistent error objects
   * 
   * @private
   * @param {string} message - Error message
   * @param {Error} error - Original error
   * @param {Object} context - Error context
   * @returns {Error} - New error
   */
  _createError(message, error, context) {
    // Use imported errors from class constructor instead of require
    const { GliaError, FunctionError } = this.errors;
    
    const errorContext = {
      ...context,
      siteId: this.siteId
    };
    
    if (error instanceof GliaError) {
      return new FunctionError(
        `${message}: ${error.message}`,
        { ...errorContext, originalError: error },
        {
          cause: error,
          endpoint: error.endpoint,
          method: error.method,
          statusCode: error.statusCode,
          requestId: error.requestId,
          requestPayload: error.requestPayload,
          responseBody: error.responseBody
        }
      );
    } else {
      return new FunctionError(`${message}: ${error.message}`, errorContext);
    }
  }
  
  /**
   * Enable or disable offline mode
   * 
   * @param {boolean} enabled - Whether to enable offline mode
   */
  setOfflineMode(enabled) {
    if (this.offlineManager) {
      this.offlineManager.setEnabled(enabled);
      
      if (this.logLevel !== 'silent') {
        console.info(`[API] Offline mode ${enabled ? 'enabled' : 'disabled'}`);
      }
    }
  }
  
  /**
   * Manually set the network status (override automatic detection)
   * 
   * @param {boolean} offline - Whether the network is offline
   */
  setNetworkStatus(offline) {
    if (this.offlineManager && this.offlineManager.networkDetector) {
      // Update the networkDetector's status directly
      this.offlineManager.networkDetector.isOffline = offline;
      
      if (this.logRequests) {
        console.log(`[API] Network status manually set to ${offline ? 'offline' : 'online'}`);
      }
    }
  }
  
  /**
   * Manually trigger a network status check
   * 
   * @returns {Promise<boolean>} Whether the network is offline
   */
  async checkNetworkStatus() {
    if (!this.offlineManager || !this.offlineManager.networkDetector) {
      return false;
    }
    
    const isOffline = await this.offlineManager.networkDetector.checkNow();
    
    if (this.logRequests) {
      console.log(`[API] Network check result: ${isOffline ? 'offline' : 'online'}`);
    }
    
    return isOffline;
  }
  
  /**
   * Get the number of pending operations in the offline queue
   * 
   * @returns {Promise<number>} - Number of pending operations
   */
  async getPendingOperationsCount() {
    if (!this.offlineManager || !this.offlineManager.operationQueue) {
      return 0;
    }
    
    const operations = await this.offlineManager.operationQueue.getPendingOperations();
    return operations.length;
  }
  
  /**
   * List all key-value pairs in a namespace
   * 
   * @param {string} namespace - The KV store namespace
   * @param {Object} options - List options
   * @param {number} options.limit - Maximum number of results to return (per page)
   * @param {string} options.cursor - Pagination cursor for fetching next page
   * @param {boolean} options.fetchAll - Whether to fetch all pages automatically
   * @returns {Promise<Object>} - KV pairs list response
   */
  async listKvPairs(namespace, options = {}) {
    try {
      if (!namespace) {
        throw new ValidationError('Namespace is required', { field: 'namespace' }, {});
      }
      
      // Build query parameters
      const queryParams = [`namespace=${encodeURIComponent(namespace)}`];
      if (options.limit) {
        queryParams.push(`per_page=${options.limit}`);
      }
      if (options.cursor) {
        queryParams.push(`cursor=${encodeURIComponent(options.cursor)}`);
      }
      
      const endpoint = `/functions/kv?${queryParams.join('&')}`;
      const initialResponse = await this.makeRequest(endpoint, {}, {
        useCache: options.useCache !== false,
        forceRefresh: options.forceRefresh === true
      });
      
      // If fetchAll is true, get all pages
      if (options.fetchAll && initialResponse.next_page_cursor) {
        return this._fetchAllKvPairs(namespace, initialResponse);
      }
      
      return initialResponse;
    } catch (error) {
      const errorContext = {
        operation: 'listKvPairs',
        siteId: this.siteId,
        namespace
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to list KV pairs: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to list KV pairs: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Helper function to fetch all pages of KV pairs
   * 
   * @private
   * @param {string} namespace - The KV store namespace
   * @param {Object} initialResponse - Initial API response
   * @returns {Promise<Object>} - Combined results from all pages
   */
  async _fetchAllKvPairs(namespace, initialResponse) {
    const allItems = [...(initialResponse.items || [])];
    let nextCursor = initialResponse.next_page_cursor;
    
    // Fetch all subsequent pages
    while (nextCursor) {
      const queryParams = [
        `namespace=${encodeURIComponent(namespace)}`,
        `cursor=${encodeURIComponent(nextCursor)}`
      ];
      
      const endpoint = `/functions/kv?${queryParams.join('&')}`;
      const response = await this.makeRequest(endpoint);
      
      if (response.items && response.items.length > 0) {
        allItems.push(...response.items);
      }
      
      nextCursor = response.next_page_cursor;
    }
    
    // Return combined result
    return {
      ...initialResponse,
      items: allItems,
      next_page_cursor: null,
      total_count: allItems.length
    };
  }
  
  /**
   * Perform batch operations on KV store
   * 
   * @param {string} namespace - The KV store namespace
   * @param {Array} operations - Array of operations to perform
   * @returns {Promise<Array>} - Array of operation results
   */
  async batchKvOperations(namespace, operations = []) {
    try {
      if (!namespace) {
        throw new ValidationError('Namespace is required', { field: 'namespace' }, {});
      }
      
      if (!Array.isArray(operations) || operations.length === 0) {
        throw new ValidationError('Operations array is required and cannot be empty', 
          { field: 'operations', provided: operations }, 
          {});
      }
      
      // Validate operations limit (10 per batch)
      if (operations.length > 10) {
        throw new ValidationError('Maximum of 10 operations per batch', 
          { field: 'operations', count: operations.length }, 
          {});
      }
      
      // Validate all operations
      for (const op of operations) {
        if (!op.op) {
          throw new ValidationError('Operation type required for each operation', 
            { field: 'op', operation: op }, 
            {});
        }
        
        if (!op.key) {
          throw new ValidationError('Key required for each operation', 
            { field: 'key', operation: op }, 
            {});
        }
      }
      
      // Format payload according to the API requirements
      const payload = {
        namespace,
        operations
      };
      
      const endpoint = `/functions/kv/batch`;
      return await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (error) {
      const errorContext = {
        operation: 'batchKvOperations',
        siteId: this.siteId,
        namespace,
        operationsCount: operations ? operations.length : 0
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to perform KV batch operations: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to perform KV batch operations: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Get a value from the KV store
   * 
   * @param {string} namespace - The KV store namespace
   * @param {string} key - The key to get
   * @returns {Promise<Object>} - KV pair result
   */
  async getKvValue(namespace, key) {
    try {
      if (!namespace) {
        throw new ValidationError('Namespace is required', { field: 'namespace' }, {});
      }
      
      if (!key) {
        throw new ValidationError('Key is required', { field: 'key' }, {});
      }
      
      // Use batch operation with a single get
      const operations = [{
        op: 'get',
        key
      }];
      
      const result = await this.batchKvOperations(namespace, operations);
      return result && result.length > 0 ? result[0] : null;
    } catch (error) {
      const errorContext = {
        operation: 'getKvValue',
        siteId: this.siteId,
        namespace,
        key
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to get KV value: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to get KV value: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Set a value in the KV store
   * 
   * @param {string} namespace - The KV store namespace
   * @param {string} key - The key to set
   * @param {string|boolean} value - The value to set
   * @returns {Promise<Object>} - KV pair result
   */
  async setKvValue(namespace, key, value) {
    try {
      if (!namespace) {
        throw new ValidationError('Namespace is required', { field: 'namespace' }, {});
      }
      
      if (!key) {
        throw new ValidationError('Key is required', { field: 'key' }, {});
      }
      
      if (value === undefined) {
        throw new ValidationError('Value is required', { field: 'value' }, {});
      }
      
      // Validate key length (max 512 bytes)
      if (Buffer.from(key).length > 512) {
        throw new ValidationError('Key exceeds maximum length of 512 bytes', 
          { field: 'key', length: Buffer.from(key).length }, 
          {});
      }
      
      // Validate value type (string or boolean)
      if (typeof value !== 'string' && typeof value !== 'boolean' && value !== null) {
        throw new ValidationError('Value must be a string, boolean, or null', 
          { field: 'value', type: typeof value }, 
          {});
      }
      
      // Validate value size (max 16KB)
      if (typeof value === 'string' && Buffer.from(value).length > 16000) {
        throw new ValidationError('Value exceeds maximum size of 16,000 bytes', 
          { field: 'value', size: Buffer.from(value).length }, 
          {});
      }
      
      // Use batch operation with a single set
      const operations = [{
        op: 'set',
        key,
        value
      }];
      
      const result = await this.batchKvOperations(namespace, operations);
      return result && result.length > 0 ? result[0] : null;
    } catch (error) {
      const errorContext = {
        operation: 'setKvValue',
        siteId: this.siteId,
        namespace,
        key,
        valueType: typeof value
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to set KV value: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to set KV value: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Delete a value from the KV store
   * 
   * @param {string} namespace - The KV store namespace
   * @param {string} key - The key to delete
   * @returns {Promise<Object>} - KV pair result
   */
  async deleteKvValue(namespace, key) {
    try {
      if (!namespace) {
        throw new ValidationError('Namespace is required', { field: 'namespace' }, {});
      }
      
      if (!key) {
        throw new ValidationError('Key is required', { field: 'key' }, {});
      }
      
      // Use batch operation with a single delete
      const operations = [{
        op: 'delete',
        key
      }];
      
      const result = await this.batchKvOperations(namespace, operations);
      return result && result.length > 0 ? result[0] : null;
    } catch (error) {
      const errorContext = {
        operation: 'deleteKvValue',
        siteId: this.siteId,
        namespace,
        key
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to delete KV value: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to delete KV value: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Test and set a value in the KV store (conditional update)
   * 
   * @param {string} namespace - The KV store namespace
   * @param {string} key - The key to update
   * @param {string|boolean} oldValue - The expected current value
   * @param {string|boolean} newValue - The new value to set
   * @returns {Promise<Object>} - KV pair result
   */
  async testAndSetKvValue(namespace, key, oldValue, newValue) {
    try {
      if (!namespace) {
        throw new ValidationError('Namespace is required', { field: 'namespace' }, {});
      }
      
      if (!key) {
        throw new ValidationError('Key is required', { field: 'key' }, {});
      }
      
      if (oldValue === undefined) {
        throw new ValidationError('Old value is required', { field: 'oldValue' }, {});
      }
      
      if (newValue === undefined) {
        throw new ValidationError('New value is required', { field: 'newValue' }, {});
      }
      
      // Use batch operation with a single testAndSet
      const operations = [{
        op: 'testAndSet',
        key,
        oldValue,
        newValue
      }];
      
      const result = await this.batchKvOperations(namespace, operations);
      return result && result.length > 0 ? result[0] : null;
    } catch (error) {
      const errorContext = {
        operation: 'testAndSetKvValue',
        siteId: this.siteId,
        namespace,
        key
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to test and set KV value: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to test and set KV value: ${error.message}`, errorContext);
      }
    }
  }
  
  /**
   * Update function details
   *
   * @param {string} functionId - Function ID
   * @param {Object} updates - Fields to update
   * @param {string} [updates.name] - New function name
   * @param {string} [updates.description] - New function description
   * @param {number} [updates.warmInstances] - Number of warm instances (0-5)
   * @returns {Promise<Object>} - Updated function details
   */
  async updateFunction(functionId, updates = {}) {
    try {
      validateFunctionId(functionId);

      // Validate name if provided
      if (updates.name !== undefined) {
        validateFunctionName(updates.name);
      }

      // Validate warm instances if provided
      if (updates.warmInstances !== undefined) {
        const warmInstances = parseInt(updates.warmInstances, 10);
        if (isNaN(warmInstances) || warmInstances < 0 || warmInstances > 5) {
          throw new ValidationError('warm_instances must be a number between 0 and 5');
        }
      }

      // Create the update payload
      const payload = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.warmInstances !== undefined) payload.warm_instances = parseInt(updates.warmInstances, 10);

      // Using the correct endpoint from the OpenAPI spec
      const endpoint = `/functions/${functionId}`;
      return await this.makeRequest(endpoint, {
        method: 'PATCH',
        headers: this._prepareHeaders(),
        body: JSON.stringify(payload)
      });
    } catch (error) {
      const errorContext = {
        operation: 'updateFunction',
        siteId: this.siteId,
        functionId,
        updates
      };
      
      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to update function: ${error.message}`, 
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId,
            requestPayload: error.requestPayload,
            responseBody: error.responseBody
          }
        );
      } else {
        throw new FunctionError(`Failed to update function: ${error.message}`, errorContext);
      }
    }
  }

  /**
   * Delete a function
   *
   * @param {string} functionId - Function ID to delete
   * @returns {Promise<void>}
   */
  async deleteFunction(functionId) {
    try {
      validateFunctionId(functionId);

      const endpoint = `/functions/${functionId}`;
      await this.makeRequest(endpoint, {
        method: 'DELETE',
        headers: this._prepareHeaders()
      });
    } catch (error) {
      const errorContext = {
        operation: 'deleteFunction',
        siteId: this.siteId,
        functionId
      };

      if (error instanceof GliaError) {
        throw new FunctionError(
          `Failed to delete function: ${error.message}`,
          { ...errorContext, originalError: error },
          {
            cause: error,
            endpoint: error.endpoint,
            method: error.method,
            statusCode: error.statusCode,
            requestId: error.requestId
          }
        );
      } else {
        throw new FunctionError(`Failed to delete function: ${error.message}`, errorContext);
      }
    }
  }

  /**
   * Create a scheduled trigger
   *
   * @param {Object} options - Trigger options
   * @param {string} options.name - Trigger name
   * @param {string} options.description - Trigger description
   * @param {string} options.functionId - Function ID to trigger
   * @param {string} options.schedulePattern - Cron expression
   * @returns {Promise<Object>} Created trigger details
   */
  async createScheduledTrigger(options) {
    try {
      const { name, description, functionId, schedulePattern } = options;

      if (!name) {
        throw new ValidationError('Trigger name is required');
      }
      if (!functionId) {
        throw new ValidationError('Function ID is required');
      }
      if (!schedulePattern) {
        throw new ValidationError('Schedule pattern is required');
      }

      const payload = {
        name,
        description: description || '',
        trigger_type: 'function',
        trigger_id: functionId,
        schedule_pattern: schedulePattern
      };

      const endpoint = `/api/v2/scheduled-triggers`;
      return await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (error) {
      if (error instanceof GliaError) {
        throw error;
      }
      throw new GliaError(`Failed to create scheduled trigger: ${error.message}`);
    }
  }

  /**
   * List all scheduled triggers
   *
   * @returns {Promise<Object>} List of scheduled triggers
   */
  async listScheduledTriggers() {
    try {
      const endpoint = `/api/v2/scheduled-triggers`;
      return await this.makeRequest(endpoint, {
        method: 'GET'
      });
    } catch (error) {
      if (error instanceof GliaError) {
        throw error;
      }
      throw new GliaError(`Failed to list scheduled triggers: ${error.message}`);
    }
  }

  /**
   * Get a scheduled trigger by ID
   *
   * @param {string} triggerId - Trigger ID
   * @returns {Promise<Object>} Trigger details
   */
  async getScheduledTrigger(triggerId) {
    try {
      if (!triggerId) {
        throw new ValidationError('Trigger ID is required');
      }

      const endpoint = `/api/v2/scheduled-triggers/${triggerId}`;
      return await this.makeRequest(endpoint, {
        method: 'GET'
      });
    } catch (error) {
      if (error instanceof GliaError) {
        throw error;
      }
      throw new GliaError(`Failed to get scheduled trigger: ${error.message}`);
    }
  }

  /**
   * Update a scheduled trigger
   *
   * @param {string} triggerId - Trigger ID
   * @param {Object} updates - Fields to update
   * @param {string} [updates.name] - New name
   * @param {string} [updates.description] - New description
   * @param {string} [updates.schedulePattern] - New schedule pattern
   * @param {boolean} [updates.enabled] - Enable/disable trigger
   * @returns {Promise<Object>} Updated trigger details
   */
  async updateScheduledTrigger(triggerId, updates) {
    try {
      if (!triggerId) {
        throw new ValidationError('Trigger ID is required');
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new ValidationError('At least one field to update is required');
      }

      // Build JSON Patch operations
      const operations = [];

      if (updates.name !== undefined) {
        operations.push({
          op: 'replace',
          path: '/name',
          value: updates.name
        });
      }

      if (updates.description !== undefined) {
        operations.push({
          op: 'replace',
          path: '/description',
          value: updates.description
        });
      }

      if (updates.schedulePattern !== undefined) {
        operations.push({
          op: 'replace',
          path: '/schedule_pattern',
          value: updates.schedulePattern
        });
      }

      if (updates.enabled !== undefined) {
        operations.push({
          op: 'replace',
          path: '/enabled',
          value: updates.enabled
        });
      }

      const endpoint = `/api/v2/scheduled-triggers/${triggerId}`;
      return await this.makeRequest(endpoint, {
        method: 'PATCH',
        headers: {
          ...this._prepareHeaders(),
          'Content-Type': 'application/json-patch+json'
        },
        body: JSON.stringify({ operations })
      });
    } catch (error) {
      if (error instanceof GliaError) {
        throw error;
      }
      throw new GliaError(`Failed to update scheduled trigger: ${error.message}`);
    }
  }

  /**
   * Delete a scheduled trigger
   *
   * @param {string} triggerId - Trigger ID to delete
   * @returns {Promise<void>}
   */
  async deleteScheduledTrigger(triggerId) {
    try {
      if (!triggerId) {
        throw new ValidationError('Trigger ID is required');
      }

      const endpoint = `/api/v2/scheduled-triggers/${triggerId}`;
      await this.makeRequest(endpoint, {
        method: 'DELETE'
      });
    } catch (error) {
      if (error instanceof GliaError) {
        throw error;
      }
      throw new GliaError(`Failed to delete scheduled trigger: ${error.message}`);
    }
  }
}
