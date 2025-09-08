/**
 * Retry utilities for handling transient errors
 * 
 * This module provides functions for implementing retry logic with exponential backoff
 * for handling transient errors when making API calls.
 */

import { logger } from './logging.js';

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  factor: 2,
  jitter: true
};

/**
 * Sleep for a specified duration
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} Promise that resolves after the delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and optional jitter
 * 
 * @param {number} attempt - Current attempt number (starting from 0)
 * @param {Object} options - Retry options
 * @returns {number} Delay in milliseconds
 */
function calculateDelay(attempt, options) {
  const { initialDelay, maxDelay, factor, jitter } = options;
  
  // Calculate exponential backoff
  let delay = initialDelay * Math.pow(factor, attempt);
  
  // Apply jitter if enabled (adds randomness to prevent thundering herd)
  if (jitter) {
    delay = Math.random() * delay * 0.3 + delay * 0.85;
  }
  
  // Cap at max delay
  return Math.min(delay, maxDelay);
}

/**
 * Execute a function with retry logic using exponential backoff
 * 
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Rethrows the last error if all retries fail
 */
export async function retryWithBackoff(fn, options = {}) {
  // Merge default options with provided options
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const { maxRetries } = retryOptions;
  
  let lastError;
  
  // Try up to maxRetries + 1 times (initial attempt + retries)
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If not the first attempt, log retry and wait
      if (attempt > 0) {
        const delay = calculateDelay(attempt - 1, retryOptions);
        logger.info(`Retry attempt ${attempt} of ${maxRetries} after ${Math.round(delay)}ms`);
        await sleep(delay);
      }
      
      // Execute the function
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Only log if we're going to retry
      if (attempt < maxRetries) {
        logger.warn(`Operation failed, will retry: ${error.message}`, { attempt, maxRetries });
      }
    }
  }
  
  // If we got here, all attempts failed
  logger.error(`All ${maxRetries + 1} attempts failed`, { error: lastError.message });
  throw lastError;
}

/**
 * Create a retry-enabled fetch function
 * 
 * @param {Object} options - Retry options
 * @returns {Function} Fetch function with retry
 */
export function createRetryFetch(options = {}) {
  return (url, fetchOptions = {}) => {
    return retryWithBackoff(() => fetch(url, fetchOptions), options);
  };
}

export default {
  retryWithBackoff,
  createRetryFetch
};