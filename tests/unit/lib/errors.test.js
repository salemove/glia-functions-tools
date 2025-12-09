import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { 
  GliaError, 
  AuthenticationError, 
  ValidationError,
  ConfigurationError,
  FunctionError,
  NetworkError,
  RateLimitError
} from '../../../src/lib/errors.js';

describe('Error classes', () => {
  describe('GliaError', () => {
    it('should create a base error with correct properties', () => {
      const message = 'Test error message';
      const code = 'TEST_ERROR';
      const details = { foo: 'bar' };
      
      const error = new GliaError(message, code, details);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GliaError);
      expect(error.message).toBe(message);
      expect(error.code).toBe(code);
      expect(error.details).toEqual(details);
      expect(error.name).toBe('GliaError');
    });

    it('should create error with context options', () => {
      const message = 'Test error message';
      const code = 'TEST_ERROR';
      const details = { foo: 'bar' };
      const options = {
        requestId: 'req-123',
        endpoint: '/test/endpoint',
        method: 'POST',
        statusCode: 400,
        requestPayload: { test: true },
        responseBody: { error: 'Bad request' }
      };
      
      const error = new GliaError(message, code, details, options);
      
      expect(error.message).toBe(message);
      expect(error.requestId).toBe(options.requestId);
      expect(error.endpoint).toBe(options.endpoint);
      expect(error.method).toBe(options.method);
      expect(error.statusCode).toBe(options.statusCode);
      expect(error.requestPayload).toEqual(options.requestPayload);
      expect(error.responseBody).toEqual(options.responseBody);
      expect(error.timestamp).toBeDefined();
    });
    
    it('should create error from API response', () => {
      const response = { 
        status: 400,
        headers: {
          get: jest.fn(key => key === 'x-request-id' ? 'req-123' : null)
        }
      };
      const data = { error: 'Bad request' };
      const requestInfo = {
        endpoint: '/test/endpoint',
        method: 'POST',
        payload: { test: true }
      };
      
      const error = GliaError.fromApiResponse(response, data, requestInfo);
      
      expect(error).toBeInstanceOf(GliaError);
      expect(error).toBeInstanceOf(ValidationError); // For 400 errors we now get ValidationError
      expect(error.message).toBe('Bad request');
      expect(error.code).toBe('VALIDATION_ERROR'); // ValidationError has this code
      expect(error.details).toMatchObject({ ...data, statusCode: 400 }); // We add statusCode to details
      expect(error.requestId).toBe('req-123');
      expect(error.endpoint).toBe('/test/endpoint');
      expect(error.method).toBe('POST');
      expect(error.statusCode).toBe(400);
      expect(error.requestPayload).toEqual({ test: true });
      expect(error.responseBody).toEqual(data);
    });
    
    it('should create appropriate error type based on status code', () => {
      // 401 should create AuthenticationError
      const authResponse = { status: 401, headers: { get: jest.fn() } };
      const authError = GliaError.fromApiResponse(authResponse, { error: 'Unauthorized' });
      expect(authError).toBeInstanceOf(AuthenticationError);
      
      // 400 should create ValidationError
      const validationResponse = { status: 400, headers: { get: jest.fn() } };
      const validationError = GliaError.fromApiResponse(validationResponse, { error: 'Bad request' });
      expect(validationError).toBeInstanceOf(ValidationError);
      
      // 404 should create a GliaError with NOT_FOUND message
      const notFoundResponse = { status: 404, headers: { get: jest.fn() } };
      const notFoundError = GliaError.fromApiResponse(notFoundResponse, null, { endpoint: '/test' });
      expect(notFoundError.message).toContain('Resource not found');
      
      // 500 should create NetworkError
      const serverResponse = { status: 500, headers: { get: jest.fn() } };
      const serverError = GliaError.fromApiResponse(serverResponse, { error: 'Server error' });
      expect(serverError).toBeInstanceOf(NetworkError);
    });
    
    it('should handle missing data in API response', () => {
      const response = { status: 500, headers: { get: jest.fn() } };
      
      const error = GliaError.fromApiResponse(response, null);
      
      expect(error).toBeInstanceOf(GliaError);
      expect(error).toBeInstanceOf(NetworkError); // Now returns NetworkError for 500+ status codes
      expect(error.message).toContain('API Error (500)'); // Message is prefixed with "Server error (500):"
      expect(error.code).toBe('NETWORK_ERROR'); // NetworkError has this code 
      expect(error.details).toMatchObject({ statusCode: 500 }); // We add statusCode to details
    });
    
    it('should create error from a caught error', () => {
      const originalError = new Error('Original error');
      const contextMessage = 'Failed during operation';
      const requestInfo = { endpoint: '/test', method: 'GET' };
      
      const error = GliaError.fromError(originalError, contextMessage, requestInfo);
      
      expect(error).toBeInstanceOf(GliaError);
      expect(error.message).toContain(contextMessage);
      expect(error.message).toContain(originalError.message);
      expect(error.endpoint).toBe(requestInfo.endpoint);
      expect(error.method).toBe(requestInfo.method);
    });
    
    it('should handle network fetch errors', () => {
      const fetchError = new TypeError('Failed to fetch');
      const error = GliaError.fromError(fetchError, 'API Request Failed');
      
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toContain('API Request Failed');
      expect(error.message).toContain('Failed to fetch');
    });
    
    it('should handle JSON parsing errors', () => {
      const parseError = new SyntaxError('Unexpected token in JSON at position 0');
      const error = GliaError.fromError(parseError, 'JSON Parse Error');
      
      expect(error).toBeInstanceOf(GliaError);
      expect(error.code).toBe('PARSE_ERROR');
      expect(error.message).toContain('JSON Parse Error');
      expect(error.message).toContain('Unexpected token');
    });
    
    it('should format error with context', () => {
      const error = new GliaError(
        'Test error',
        'TEST_ERROR',
        { foo: 'bar' },
        {
          statusCode: 400,
          endpoint: '/test/endpoint',
          method: 'POST',
          requestId: 'req-123',
          responseBody: { message: 'Error details' }
        }
      );
      
      const formatted = error.formatWithContext();
      
      expect(formatted).toContain('GliaError (TEST_ERROR): Test error');
      expect(formatted).toContain('Status Code: 400');
      expect(formatted).toContain('Endpoint: POST /test/endpoint');
      expect(formatted).toContain('Request ID: req-123');
      expect(formatted).toContain('Details: ');
      expect(formatted).toContain('foo');
      expect(formatted).toContain('bar');
      expect(formatted).toContain('Response: ');
      expect(formatted).toContain('message');
      expect(formatted).toContain('Error details');
    });
  });
  
  describe('AuthenticationError', () => {
    it('should create with correct properties', () => {
      const message = 'Authentication failed';
      const details = { reason: 'Invalid token' };
      
      const error = new AuthenticationError(message, details);
      
      expect(error).toBeInstanceOf(GliaError);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe(message);
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.details).toEqual(details);
      expect(error.name).toBe('AuthenticationError');
    });
    
    it('should provide troubleshooting hints', () => {
      const error = new AuthenticationError('Authentication failed');
      const hints = error.getTroubleshootingHints();
      
      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(hint => hint.includes('token'))).toBe(true);
    });
  });
  
  describe('ValidationError', () => {
    it('should create with correct properties', () => {
      const message = 'Validation failed';
      
      const error = new ValidationError(message);
      
      expect(error).toBeInstanceOf(GliaError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe(message);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toBeNull();
      expect(error.name).toBe('ValidationError');
    });
    
    it('should extract field information from details', () => {
      const message = 'Invalid field value';
      const details = {
        field: 'username',
        provided: 'admin@',
        expected: 'Valid email address'
      };
      
      const error = new ValidationError(message, details);
      
      expect(error.field).toBe(details.field);
      expect(error.provided).toBe(details.provided);
      expect(error.expected).toBe(details.expected);
    });
    
    it('should format validation error with field context', () => {
      const message = 'Invalid field value';
      const details = {
        field: 'username',
        provided: 'admin@',
        expected: 'Valid email address'
      };
      
      const error = new ValidationError(message, details);
      const formatted = error.formatWithContext();
      
      expect(formatted).toContain('Field: username');
      expect(formatted).toContain('Provided: admin@');
      expect(formatted).toContain('Expected: Valid email address');
    });
  });
  
  describe('ConfigurationError', () => {
    it('should create with correct properties', () => {
      const message = 'Missing configuration';
      
      const error = new ConfigurationError(message);
      
      expect(error).toBeInstanceOf(GliaError);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe(message);
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.details).toBeNull();
      expect(error.name).toBe('ConfigurationError');
    });
    
    it('should extract configuration details', () => {
      const message = 'Configuration error';
      const details = {
        missingFields: ['apiKey', 'siteId'],
        invalidFields: ['region'],
        configFile: '/path/to/config.json'
      };
      
      const error = new ConfigurationError(message, details);
      
      expect(error.missingFields).toEqual(details.missingFields);
      expect(error.invalidFields).toEqual(details.invalidFields);
      expect(error.configFile).toBe(details.configFile);
    });
    
    it('should provide troubleshooting hints', () => {
      const message = 'Configuration error';
      const details = {
        missingFields: ['apiKey', 'siteId'],
        invalidFields: ['region'],
        configFile: '/path/to/config.json'
      };
      
      const error = new ConfigurationError(message, details);
      const hints = error.getTroubleshootingHints();
      
      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(hint => hint.includes('apiKey'))).toBe(true);
      expect(hints.some(hint => hint.includes('region'))).toBe(true);
      expect(hints.some(hint => hint.includes('/path/to/config.json'))).toBe(true);
    });
  });
  
  describe('FunctionError', () => {
    it('should create with correct properties', () => {
      const message = 'Function execution failed';
      const details = { functionId: '123' };
      
      const error = new FunctionError(message, details);
      
      expect(error).toBeInstanceOf(GliaError);
      expect(error).toBeInstanceOf(FunctionError);
      expect(error.message).toBe(message);
      expect(error.code).toBe('FUNCTION_ERROR');
      expect(error.details).toEqual(details);
      expect(error.name).toBe('FunctionError');
    });
    
    it('should extract function-specific details', () => {
      const message = 'Function error';
      const details = {
        functionId: 'func-123',
        versionId: 'v1',
        operation: 'invoke'
      };
      
      const error = new FunctionError(message, details);
      
      expect(error.functionId).toBe(details.functionId);
      expect(error.versionId).toBe(details.versionId);
      expect(error.operation).toBe(details.operation);
    });
    
    it('should handle original error in details', () => {
      const message = 'Function error';
      const originalError = new Error('Original error');
      
      const error = new FunctionError(message, originalError);
      
      expect(error.originalError).toBe(originalError);
    });
    
    it('should format function error with context', () => {
      const message = 'Function error';
      const details = {
        functionId: 'func-123',
        versionId: 'v1',
        operation: 'invoke'
      };
      
      const error = new FunctionError(message, details);
      const formatted = error.formatWithContext();
      
      expect(formatted).toContain('Function ID: func-123');
      expect(formatted).toContain('Version ID: v1');
      expect(formatted).toContain('Operation: invoke');
    });
    
    it('should provide troubleshooting hints', () => {
      const error = new FunctionError('Function error', {}, { statusCode: 404 });
      const hints = error.getTroubleshootingHints();
      
      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(hint => hint.includes('function'))).toBe(true);
      expect(hints.some(hint => hint.includes('ID exists'))).toBe(true);
    });
  });
  
  describe('NetworkError', () => {
    it('should create with correct properties', () => {
      const message = 'Network timeout';
      const details = { timeout: 3000 };
      
      const error = new NetworkError(message, details);
      
      expect(error).toBeInstanceOf(GliaError);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe(message);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.details).toEqual(details);
      expect(error.name).toBe('NetworkError');
    });
    
    it('should determine if error is retryable', () => {
      // 500 status code should be retryable
      const retriableError = new NetworkError('Server error', {}, { statusCode: 500 });
      expect(retriableError.retryable).toBe(true);
      
      // 400 status code should not be retryable
      const nonRetriableError = new NetworkError('Bad request', {}, { statusCode: 400 });
      expect(nonRetriableError.retryable).toBe(false);
      
      // 429 status code should be retryable (rate limit)
      const rateLimitError = new NetworkError('Rate limit', {}, { statusCode: 429 });
      expect(rateLimitError.retryable).toBe(true);
    });
    
    it('should extract original error', () => {
      const originalError = new Error('Original network error');
      const error = new NetworkError('Network error', { originalError });
      
      expect(error.originalError).toBe(originalError);
    });
    
    it('should provide troubleshooting hints', () => {
      const error = new NetworkError('Network error');
      const hints = error.getTroubleshootingHints();
      
      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(hint => hint.includes('internet'))).toBe(true);
    });
  });
  
  describe('RateLimitError', () => {
    it('should create with correct properties', () => {
      const message = 'Rate limit exceeded';
      const details = { endpoint: '/test' };
      const options = {
        statusCode: 429,
        retryAfter: 60,
        limit: 100,
        remaining: 0,
        reset: 1678234567000
      };
      
      const error = new RateLimitError(message, details, options);
      
      expect(error).toBeInstanceOf(NetworkError);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe(message);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.limit).toBe(100);
      expect(error.remaining).toBe(0);
      expect(error.reset).toBe(1678234567000);
    });
    
    it('should format rate limit error with context', () => {
      const message = 'Rate limit exceeded';
      const options = {
        statusCode: 429,
        retryAfter: 60,
        limit: 100,
        remaining: 0,
        reset: 1678234567000
      };
      
      const error = new RateLimitError(message, {}, options);
      const formatted = error.formatWithContext();
      
      expect(formatted).toContain('Limit: 100');
      expect(formatted).toContain('Remaining: 0');
      expect(formatted).toContain('Reset Time:');
      expect(formatted).toContain('Retry After: 60 seconds');
    });
  });
});
