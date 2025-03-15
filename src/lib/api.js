/**
 * Unified API client for interacting with the Glia Functions API
 * 
 * Provides methods for all API operations with consistent error handling,
 * retry mechanisms, and request caching capabilities
 */

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
  offline: DEFAULT_OFFLINE_CONFIG
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
      networkCheckUrl: 'https://www.gstatic.com/generate_204'
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
    this.logRequests = config.logRequests || false;
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
   * @returns {Promise<Object>} - Response data
   * @throws {GliaError} - If the request fails
   */
  async makeRequest(endpoint, options = {}, requestOptions = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';
    
    // Add request timeout if not already specified
    if (!options.signal && !options.timeout) {
      const timeout = requestOptions.timeout || 30000; // Default 30s timeout
      const controller = new AbortController();
      options.signal = controller.signal;
      
      // Set up the timeout
      setTimeout(() => {
        controller.abort();
      }, timeout);
    }
    
    // Request logging if enabled
    if (this.logRequests) {
      console.log(`[API] ${method} ${url}`);
    }
    
    // Store request info for error context
    const requestInfo = {
      endpoint,
      method,
      payload: this._extractPayload(options.body)
    };
    
    // Default request options
    const {
      useCache = true,
      forceRefresh = false,
      cacheTtl,
      useRetry = true,
      offlineMode = true   // Whether to use offline capabilities
    } = requestOptions;
    
    // Add debug info to request tracking
    const trackingInfo = {
      timestamp: new Date().toISOString(),
      cached: false,
      retries: 0,
      offline: false
    };
    
    // Check if we're offline and have offline mode enabled
    let isOffline = false;
    if (offlineMode && this.offlineManager) {
      isOffline = await this.offlineManager.isOffline();
      trackingInfo.offline = isOffline;
      
      if (isOffline && this.logRequests) {
        console.log(`[API] Operating in offline mode`);
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
        const headers = this._prepareHeaders(options.headers);
        const response = await fetch(url, {
          headers,
          ...options
        });
        
        // Extract and process response metadata
        const responseInfo = this._extractResponseMetadata(response);
        trackingInfo.requestId = responseInfo.requestId;
        
        // Parse response based on content type
        const data = await this._parseResponseData(response);
        
        // Handle rate limiting preemptively
        if (response.status === 429) {
          return this._handleRateLimit(response, responseInfo, requestInfo, data);
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
    if (!useRetry) {
      return executeRequest();
    }
    
    // Otherwise, use retry mechanism
    return withRetry(
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
          tracking: trackingInfo
        }
      }
    );
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
    return {
      'Authorization': `Bearer ${this.bearerToken}`,
      'Content-Type': 'application/json',
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
   * @returns {Promise<Object>} - Created function details
   */
  async createFunction(name, description = '') {
    try {
      validateFunctionName(name);
      
      // Using the correct endpoint from the OpenAPI spec
      const endpoint = `/functions`;
      return await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ 
          name, 
          description, 
          site_id: this.siteId // Include site_id in the request body
        })
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
   * Enable or disable offline mode
   * 
   * @param {boolean} enabled - Whether to enable offline mode
   */
  setOfflineMode(enabled) {
    if (this.offlineManager) {
      this.offlineManager.setEnabled(enabled);
      
      if (this.logRequests) {
        console.log(`[API] Offline mode ${enabled ? 'enabled' : 'disabled'}`);
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
}
