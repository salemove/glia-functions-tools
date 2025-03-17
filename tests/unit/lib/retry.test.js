import { jest } from '@jest/globals';
import { 
  DEFAULT_RETRY_CONFIG,
  CircuitBreaker,
  calculateBackoffDelay,
  isRetryable,
  withRetry,
  sleep
} from '../../../src/lib/retry.js';
import { 
  NetworkError, 
  RateLimitError, 
  FunctionError, 
  GliaError 
} from '../../../src/lib/errors.js';

describe('Retry mechanism', () => {
  beforeEach(() => {
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
      // Execute immediately for tests
      fn();
      return 123; // Mock timer ID
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sleep', () => {
    it('should return a promise that resolves after the delay', async () => {
      const start = Date.now();
      await sleep(0); // With mocked setTimeout, this will resolve immediately
      expect(setTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should return fixed delay for fixed strategy', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, retryStrategy: 'fixed', initialDelayMs: 1000 };
      expect(calculateBackoffDelay(0, config)).toBe(1000);
      expect(calculateBackoffDelay(1, config)).toBe(1000);
      expect(calculateBackoffDelay(2, config)).toBe(1000);
    });

    it('should return linear delay for linear strategy', () => {
      const config = { 
        ...DEFAULT_RETRY_CONFIG, 
        retryStrategy: 'linear', 
        initialDelayMs: 1000,
        maxDelayMs: 10000
      };
      expect(calculateBackoffDelay(0, config)).toBe(1000);
      expect(calculateBackoffDelay(1, config)).toBe(2000);
      expect(calculateBackoffDelay(2, config)).toBe(3000);
    });

    it('should return exponential delay for exponential strategy', () => {
      const config = { 
        ...DEFAULT_RETRY_CONFIG, 
        retryStrategy: 'exponential', 
        initialDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 10000
      };
      
      // Mocking Math.random to return 0.5 for consistent test results
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      
      expect(calculateBackoffDelay(0, config)).toBe(1000);
      expect(calculateBackoffDelay(1, config)).toBe(2000);
      expect(calculateBackoffDelay(2, config)).toBe(4000);
      expect(calculateBackoffDelay(3, config)).toBe(8000);
      // Should be capped at maxDelayMs
      expect(calculateBackoffDelay(4, config)).toBe(10000);
    });
    
    it('should add jitter to exponential delay', () => {
      const config = { 
        ...DEFAULT_RETRY_CONFIG, 
        retryStrategy: 'exponential', 
        initialDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 10000
      };
      
      // Test with different random values
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.6); // +10% jitter
      const delay1 = calculateBackoffDelay(1, config);
      
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.4); // -10% jitter
      const delay2 = calculateBackoffDelay(1, config);
      
      // Should be different due to jitter
      expect(delay1).not.toBe(delay2);
      
      // Both should be within 20% of base value
      const baseDelay = 1000 * Math.pow(2, 1); // 2000
      expect(delay1).toBeLessThanOrEqual(baseDelay * 1.1);
      expect(delay1).toBeGreaterThanOrEqual(baseDelay * 0.9);
      expect(delay2).toBeLessThanOrEqual(baseDelay * 1.1);
      expect(delay2).toBeGreaterThanOrEqual(baseDelay * 0.9);
    });
    
    it('should cap delay at maxDelayMs', () => {
      const config = { 
        ...DEFAULT_RETRY_CONFIG, 
        retryStrategy: 'exponential', 
        initialDelayMs: 1000,
        backoffFactor: 10,
        maxDelayMs: 5000
      };
      
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      
      // 1000 * 10^2 = 100000, but should be capped at 5000
      expect(calculateBackoffDelay(2, config)).toBe(5000);
    });
    
    it('should never go below initialDelayMs even with negative jitter', () => {
      const config = { 
        ...DEFAULT_RETRY_CONFIG, 
        retryStrategy: 'exponential', 
        initialDelayMs: 1000,
        backoffFactor: 1.5,
        maxDelayMs: 10000
      };
      
      // Force extreme negative jitter
      jest.spyOn(Math, 'random').mockReturnValue(0);
      
      const delay = calculateBackoffDelay(1, config);
      expect(delay).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('isRetryable', () => {
    const config = DEFAULT_RETRY_CONFIG;
    
    it('should return true for retryable status codes', () => {
      expect(isRetryable(408, config)).toBe(true);
      expect(isRetryable(429, config)).toBe(true);
      expect(isRetryable(500, config)).toBe(true);
      expect(isRetryable(503, config)).toBe(true);
    });
    
    it('should return false for non-retryable status codes', () => {
      expect(isRetryable(400, config)).toBe(false);
      expect(isRetryable(401, config)).toBe(false);
      expect(isRetryable(404, config)).toBe(false);
    });
    
    it('should return true for RateLimitError', () => {
      const error = new RateLimitError('Rate limited', {}, {});
      expect(isRetryable(error, config)).toBe(true);
    });
    
    it('should return true for retryable NetworkError', () => {
      const error = new NetworkError('Connection reset', {}, { retryable: true });
      expect(isRetryable(error, config)).toBe(true);
      
      const nonRetryableError = new NetworkError('Bad request', {}, { retryable: false });
      expect(isRetryable(nonRetryableError, config)).toBe(false);
    });
    
    it('should return true for errors with retryable error codes', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';
      expect(isRetryable(error, config)).toBe(true);
      
      const errorWithCause = new Error('Wrapped error');
      errorWithCause.cause = { code: 'ETIMEDOUT' };
      expect(isRetryable(errorWithCause, config)).toBe(true);
    });
    
    it('should return true for errors with retryable error messages', () => {
      expect(isRetryable(new Error('network failure'), config)).toBe(true);
      expect(isRetryable(new Error('connection timeout'), config)).toBe(true);
      expect(isRetryable(new Error('temporary error'), config)).toBe(true);
      expect(isRetryable(new Error('non-retryable error'), config)).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('should return the result when function succeeds on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('should retry when function fails with retryable error', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new NetworkError('Connection error', {}, { retryable: true }))
        .mockResolvedValueOnce('success');
      
      const onRetry = jest.fn();
      const result = await withRetry(fn, { onRetry });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
    
    it('should not retry when function fails with non-retryable error', async () => {
      const error = new FunctionError('Validation error', {}, {});
      const fn = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(fn)).rejects.toThrow(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('should give up after maxRetries attempts', async () => {
      const error = new NetworkError('Connection error', {}, { retryable: true });
      const fn = jest.fn().mockRejectedValue(error);
      
      const retryConfig = { maxRetries: 2 };
      const onRetry = jest.fn();
      
      await expect(withRetry(fn, { retryConfig, onRetry })).rejects.toThrow(error);
      
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(onRetry).toHaveBeenCalledTimes(2);
    });
    
    it('should use retry-after from RateLimitError', async () => {
      const error = new RateLimitError('Rate limited', {}, { retryAfter: 1 });
      const fn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');
      
      const onRetry = jest.fn();
      const result = await withRetry(fn, { onRetry });
      
      expect(result).toBe('success');
      expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({
        error,
        attempt: 1,
        delayMs: 1000 // 1 second converted to ms
      }));
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker;
    
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenMaxCalls: 1
      });
    });
    
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.allowRequest()).toBe(true);
    });
    
    it('should open after threshold failures', () => {
      circuitBreaker.recordFailure(); // First failure
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      circuitBreaker.recordFailure(); // Second failure (threshold reached)
      expect(circuitBreaker.getState()).toBe('OPEN');
      expect(circuitBreaker.allowRequest()).toBe(false);
    });
    
    it('should reset failure count on success', () => {
      circuitBreaker.recordFailure(); // One failure
      expect(circuitBreaker.failures).toBe(1);
      
      circuitBreaker.recordSuccess(); // Success resets counter
      expect(circuitBreaker.failures).toBe(0);
    });
    
    it('should transition to half-open after reset timeout', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure(); // Open the circuit
      expect(circuitBreaker.getState()).toBe('OPEN');
      
      // Mock elapsed time
      circuitBreaker.lastFailureTime = Date.now() - 2000; // 2 seconds ago
      
      expect(circuitBreaker.allowRequest()).toBe(true);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    });
    
    it('should close after successful half-open calls', () => {
      // Open the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      // Transition to half-open
      circuitBreaker.lastFailureTime = Date.now() - 2000;
      circuitBreaker.allowRequest(); // Triggers transition to half-open
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Success in half-open
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
    
    it('should revert to open on failure in half-open', () => {
      // Open the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      // Transition to half-open
      circuitBreaker.lastFailureTime = Date.now() - 2000;
      circuitBreaker.allowRequest();
      
      // Failure in half-open
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('OPEN');
    });
    
    it('should limit calls in half-open state', () => {
      // Open the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      // Transition to half-open
      circuitBreaker.lastFailureTime = Date.now() - 2000;
      
      // First call allowed
      expect(circuitBreaker.allowRequest()).toBe(true);
      circuitBreaker.halfOpenCalls = 1;
      
      // Subsequent calls blocked until success/failure recorded
      expect(circuitBreaker.allowRequest()).toBe(false);
    });
  });

  describe('withRetry with CircuitBreaker', () => {
    let circuitBreaker;
    
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2
      });
    });
    
    it('should update circuit breaker on success', async () => {
      const recordSuccessSpy = jest.spyOn(circuitBreaker, 'recordSuccess');
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn, { circuitBreaker });
      
      expect(result).toBe('success');
      expect(recordSuccessSpy).toHaveBeenCalledTimes(1);
    });
    
    it('should update circuit breaker on failure', async () => {
      const recordFailureSpy = jest.spyOn(circuitBreaker, 'recordFailure');
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(fn, { circuitBreaker })).rejects.toThrow(error);
      expect(recordFailureSpy).toHaveBeenCalledTimes(1);
    });
    
    it('should throw error when circuit is open', async () => {
      // Open the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      const fn = jest.fn().mockResolvedValue('success');
      
      await expect(withRetry(fn, { circuitBreaker })).rejects.toThrow(NetworkError);
      await expect(withRetry(fn, { circuitBreaker })).rejects.toThrow('Circuit breaker open');
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
