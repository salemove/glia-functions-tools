/**
 * Retry mechanism for API requests
 * 
 * Provides configurable retry strategies with exponential backoff
 * and circuit breaker functionality for the Glia API client.
 */

import { NetworkError, RateLimitError } from './errors.js';

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffFactor: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableNetworkErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'NETWORK_ERROR'],
  retryStrategy: 'exponential', // 'exponential', 'linear', or 'fixed'
};

/**
 * Circuit breaker state for tracking persistent failures
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 1;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = null;
  }

  /**
   * Record a successful call
   */
  recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
      
      // If we've had enough successful calls in half-open state, close the circuit
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        this.close();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failures on successful calls when closed
      this.failures = 0;
    }
  }

  /**
   * Record a failed call
   */
  recordFailure() {
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      // If we fail during half-open state, go back to open
      this.open();
    } else if (this.state === 'CLOSED') {
      this.failures++;
      
      // Open the circuit if we've hit the threshold
      if (this.failures >= this.failureThreshold) {
        this.open();
      }
    }
  }

  /**
   * Check if the circuit allows a call
   * @returns {boolean} - Whether the call should be allowed
   */
  allowRequest() {
    // Always allow in closed state
    if (this.state === 'CLOSED') {
      return true;
    }
    
    // Allow limited calls in half-open state
    if (this.state === 'HALF_OPEN') {
      return this.halfOpenCalls < this.halfOpenMaxCalls;
    }
    
    // In open state, check if we should transition to half-open
    if (this.state === 'OPEN' && this.lastFailureTime) {
      const elapsed = Date.now() - this.lastFailureTime;
      
      // After reset timeout, transition to half-open
      if (elapsed >= this.resetTimeoutMs) {
        this.halfOpen();
        return this.halfOpenCalls < this.halfOpenMaxCalls;
      }
    }
    
    // Default: don't allow the request
    return false;
  }

  /**
   * Open the circuit (block all calls)
   */
  open() {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
  }

  /**
   * Set to half-open state (allow limited calls)
   */
  halfOpen() {
    this.state = 'HALF_OPEN';
    this.halfOpenCalls = 0;
  }

  /**
   * Close the circuit (allow all calls)
   */
  close() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.halfOpenCalls = 0;
  }

  /**
   * Get the current circuit state
   * @returns {string} - 'CLOSED', 'OPEN', or 'HALF_OPEN'
   */
  getState() {
    return this.state;
  }
}

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate delay time using exponential backoff
 * @param {number} retryCount - The current retry attempt number (0-based)
 * @param {Object} config - Retry configuration
 * @returns {number} - Delay in milliseconds
 */
export const calculateBackoffDelay = (retryCount, config) => {
  if (config.retryStrategy === 'fixed') {
    return config.initialDelayMs;
  }
  
  if (config.retryStrategy === 'linear') {
    return Math.min(
      config.initialDelayMs * (retryCount + 1),
      config.maxDelayMs
    );
  }
  
  // Default: exponential
  const delay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffFactor, retryCount),
    config.maxDelayMs
  );
  
  // Add jitter (±20%) to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.max(config.initialDelayMs, delay + jitter);
};

/**
 * Check if an error or status code is retryable
 * @param {Error|number} errorOrStatus - Error object or HTTP status code
 * @param {Object} config - Retry configuration
 * @returns {boolean} - Whether the error/status is retryable
 */
export const isRetryable = (errorOrStatus, config) => {
  // Handle HTTP status codes
  if (typeof errorOrStatus === 'number') {
    return config.retryableStatusCodes.includes(errorOrStatus);
  }
  
  // Handle errors
  if (errorOrStatus instanceof Error) {
    // Rate limit errors are always retryable
    if (errorOrStatus instanceof RateLimitError) {
      return true;
    }
    
    // Network errors are potentially retryable
    if (errorOrStatus instanceof NetworkError) {
      return errorOrStatus.retryable === true;
    }
    
    // Check error codes from underlying network errors
    const errorCode = errorOrStatus.code || 
                     (errorOrStatus.cause && errorOrStatus.cause.code);
    if (errorCode && config.retryableNetworkErrors.includes(errorCode)) {
      return true;
    }
    
    // Look for specific error messages that indicate retryable conditions
    const errorMessage = errorOrStatus.message.toLowerCase();
    return errorMessage.includes('timeout') || 
           errorMessage.includes('network') ||
           errorMessage.includes('connection') ||
           errorMessage.includes('temporary');
  }
  
  return false;
};

/**
 * Execute a function with retry logic
 * @param {Function} fn - The function to execute (returns a promise)
 * @param {Object} options - Retry options
 * @param {Object} options.retryConfig - Retry configuration (extends DEFAULT_RETRY_CONFIG)
 * @param {CircuitBreaker} options.circuitBreaker - Optional circuit breaker
 * @param {Function} options.onRetry - Called before each retry attempt
 * @returns {Promise<any>} - The result of the function
 */
export const withRetry = async (fn, options = {}) => {
  const config = { ...DEFAULT_RETRY_CONFIG, ...(options.retryConfig || {}) };
  const circuitBreaker = options.circuitBreaker;
  const onRetry = options.onRetry || (() => {});
  const contextInfo = options.context || {};
  
  // Check circuit breaker first
  if (circuitBreaker && !circuitBreaker.allowRequest()) {
    throw new NetworkError(
      'Circuit breaker open: too many recent failures',
      { circuitState: circuitBreaker.getState() },
      { statusCode: 0 }
    );
  }
  
  let lastError;
  
  // Try the initial request and up to maxRetries additional attempts
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Execute the function
      const result = await fn();
      
      // Record success in circuit breaker
      if (circuitBreaker) {
        circuitBreaker.recordSuccess();
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry if we've exhausted attempts
      if (attempt >= config.maxRetries) {
        break;
      }
      
      // Don't retry if the error is not retryable
      if (!isRetryable(error, config)) {
        break;
      }
      
      // For rate limit errors, use retry-after if provided
      let delayMs;
      if (error instanceof RateLimitError && error.retryAfter) {
        delayMs = error.retryAfter * 1000;
      } else {
        delayMs = calculateBackoffDelay(attempt, config);
      }
      
      // Call the onRetry callback with relevant info
      await onRetry({
        error,
        attempt: attempt + 1,
        delayMs,
        ...contextInfo
      });
      
      // Wait before retrying
      await sleep(delayMs);
    }
  }
  
  // If we got here, all retries failed
  if (circuitBreaker) {
    circuitBreaker.recordFailure();
  }
  
  throw lastError;
};
