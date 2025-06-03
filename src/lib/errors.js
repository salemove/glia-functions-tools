/**
 * Custom error classes for the Glia Functions CLI
 * 
 * Provides structured error types with codes, improved error messages,
 * and comprehensive contextual information for better debugging and user feedback
 */

/**
 * Base error class for all Glia API related errors
 */
export class GliaError extends Error {
  /**
   * Create a new GliaError
   * 
   * @param {string} message - Error message
   * @param {string} code - Error code for programmatic handling
   * @param {object|null} details - Additional error details
   * @param {object} options - Additional options for the error
   * @param {Error} options.cause - Original error that caused this error
   * @param {string} options.requestId - Request ID for correlation
   * @param {string} options.endpoint - API endpoint that was accessed
   * @param {string} options.method - HTTP method used for the request
   * @param {number} options.statusCode - HTTP status code of the response
   * @param {object} options.requestPayload - Request payload sent to the API
   * @param {object} options.responseBody - Response body received from the API
   */
  constructor(message, code = 'UNKNOWN_ERROR', details = null, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'GliaError';
    this.code = code;
    this.details = details;
    this.requestId = options.requestId;
    this.endpoint = options.endpoint;
    this.method = options.method;
    this.statusCode = options.statusCode;
    this.requestPayload = options.requestPayload;
    this.responseBody = options.responseBody;
    this.timestamp = new Date().toISOString();
  }
  
  /**
   * Format the error for display, including contextual information
   * 
   * @returns {string} - Formatted error message with context
   */
  formatWithContext() {
    let message = `${this.name} (${this.code}): ${this.message}`;
    
    if (this.statusCode) {
      message += `\nStatus Code: ${this.statusCode}`;
    }
    
    if (this.endpoint) {
      message += `\nEndpoint: ${this.method || 'GET'} ${this.endpoint}`;
    }
    
    if (this.requestId) {
      message += `\nRequest ID: ${this.requestId}`;
    }
    
    if (this.details) {
      message += '\nDetails: ' + JSON.stringify(this.details, null, 2);
    }
    
    if (this.responseBody) {
      message += '\nResponse: ' + JSON.stringify(this.responseBody, null, 2);
    }
    
    return message;
  }
  
  /**
   * Create a GliaError from an API response
   * 
   * @param {Response} response - Fetch API Response object
   * @param {object|null} data - Parsed response data if available
   * @param {object} requestInfo - Information about the request
   * @param {string} requestInfo.endpoint - API endpoint that was accessed
   * @param {string} requestInfo.method - HTTP method used
   * @param {object} requestInfo.payload - Request payload if applicable
   * @returns {GliaError} - Appropriate error instance
   */
  static fromApiResponse(response, data, requestInfo = {}) {
    const statusCode = response.status;
    const requestId = response.headers?.get('x-request-id') || 
                      response.headers?.get('request-id') || null;
    
    // Extract error message from response data
    let message;
    if (data?.error) {
      message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    } else if (data?.message) {
      message = data.message;
    } else {
      message = `API Error (${statusCode})`;
    }
    
    const code = `API_${statusCode}`;
    
    // Create options object with contextual information
    const options = {
      statusCode,
      requestId,
      endpoint: requestInfo.endpoint,
      method: requestInfo.method,
      requestPayload: requestInfo.payload,
      responseBody: data
    };
    
    // Create specific error types based on status code
    if (statusCode === 401 || statusCode === 403) {
      return new AuthenticationError(message, { ...data, statusCode }, options);
    } else if (statusCode === 404) {
      return new GliaError(`Resource not found: ${requestInfo.endpoint || ''}`, code, data, options);
    } else if (statusCode === 400) {
      return new ValidationError(message, { ...data, statusCode }, options);
    } else if (statusCode >= 500) {
      return new NetworkError(`Server error (${statusCode}): ${message}`, { ...data, statusCode }, options);
    }
    
    return new GliaError(message, code, data, options);
  }
  
  /**
   * Create a specific error type from a caught error
   * 
   * @param {Error} error - The caught error
   * @param {string} contextMessage - Additional context message
   * @param {object} requestInfo - Information about the request context
   * @returns {GliaError} - Appropriate error instance
   */
  static fromError(error, contextMessage, requestInfo = {}) {
    // If it's already a GliaError, add additional context
    if (error instanceof GliaError) {
      if (contextMessage) {
        error.message = `${contextMessage}: ${error.message}`;
      }
      return error;
    }
    
    // For fetch/network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new NetworkError(
        `${contextMessage || 'Network error'}: ${error.message}`,
        { originalError: error },
        { cause: error, ...requestInfo }
      );
    }
    
    // For JSON parsing errors
    if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
      return new GliaError(
        `${contextMessage || 'Invalid JSON response'}: ${error.message}`,
        'PARSE_ERROR',
        { originalError: error },
        { cause: error, ...requestInfo }
      );
    }
    
    // Default case
    return new GliaError(
      `${contextMessage || 'Error'}: ${error.message}`,
      'UNKNOWN_ERROR',
      { originalError: error },
      { cause: error, ...requestInfo }
    );
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends GliaError {
  /**
   * Create a new AuthenticationError
   * 
   * @param {string} message - Error message
   * @param {object|null} details - Additional error details
   * @param {object} options - Additional options for the error
   */
  constructor(message, details = null, options = {}) {
    super(message, 'AUTH_ERROR', details, options);
    this.name = 'AuthenticationError';
  }
  
  /**
   * Get troubleshooting hints for authentication errors
   * 
   * @returns {string[]} - Array of troubleshooting hints
   */
  getTroubleshootingHints() {
    return [
      'Check that your API token is correct and not expired',
      'Verify that your token has the necessary permissions',
      'Ensure that your site ID is correct',
      'Try regenerating your API token'
    ];
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends GliaError {
  /**
   * Create a new ValidationError
   * 
   * @param {string} message - Error message
   * @param {object|null} details - Additional error details
   * @param {object} options - Additional options for the error
   */
  constructor(message, details = null, options = {}) {
    super(message, 'VALIDATION_ERROR', details, options);
    this.name = 'ValidationError';
    
    // Extract specific validation field if available
    if (details && typeof details === 'object') {
      this.field = details.field || details.key || null;
      this.provided = details.provided || null;
      this.expected = details.expected || null;
    }
  }
  
  /**
   * Format validation error with additional context
   * 
   * @returns {string} - Formatted validation error message
   */
  formatWithContext() {
    let message = super.formatWithContext();
    
    if (this.field) {
      message += `\nField: ${this.field}`;
    }
    
    if (this.provided !== undefined && this.provided !== null) {
      message += `\nProvided: ${typeof this.provided === 'object' ? 
        JSON.stringify(this.provided) : this.provided}`;
    }
    
    if (this.expected !== undefined && this.expected !== null) {
      message += `\nExpected: ${typeof this.expected === 'object' ? 
        JSON.stringify(this.expected) : this.expected}`;
    }
    
    return message;
  }
}

/**
 * Error thrown when configuration is missing or invalid
 */
export class ConfigurationError extends GliaError {
  /**
   * Create a new ConfigurationError
   * 
   * @param {string} message - Error message
   * @param {object|null} details - Additional error details
   * @param {object} options - Additional options for the error
   */
  constructor(message, details = null, options = {}) {
    super(message, 'CONFIG_ERROR', details, options);
    this.name = 'ConfigurationError';
    
    // Extract specific configuration information if available
    if (details && typeof details === 'object') {
      this.missingFields = details.missingFields || [];
      this.invalidFields = details.invalidFields || [];
      this.configFile = details.configFile || null;
    }
  }
  
  /**
   * Get troubleshooting hints for configuration errors
   * 
   * @returns {string[]} - Array of troubleshooting hints
   */
  getTroubleshootingHints() {
    const hints = [
      'Check your configuration file for syntax errors',
      'Ensure all required configuration values are provided'
    ];
    
    if (this.missingFields && this.missingFields.length > 0) {
      hints.push(`Required fields missing: ${this.missingFields.join(', ')}`);
    }
    
    if (this.invalidFields && this.invalidFields.length > 0) {
      hints.push(`Invalid fields: ${this.invalidFields.join(', ')}`);
    }
    
    if (this.configFile) {
      hints.push(`Configuration file: ${this.configFile}`);
    }
    
    return hints;
  }
}

/**
 * Error thrown when function operations fail
 */
export class FunctionError extends GliaError {
  /**
   * Create a new FunctionError
   * 
   * @param {string} message - Error message
   * @param {object|null} details - Additional error details
   * @param {object} options - Additional options for the error
   */
  constructor(message, details = null, options = {}) {
    super(message, 'FUNCTION_ERROR', details, options);
    this.name = 'FunctionError';
    
    // Extract function-specific information
    if (details) {
      if (details instanceof Error) {
        this.originalError = details;
      } else if (typeof details === 'object') {
        this.functionId = details.functionId || details.function_id || null;
        this.versionId = details.versionId || details.version_id || null;
        this.operation = details.operation || null;
      }
    }
  }
  
  /**
   * Format function error with additional context
   * 
   * @returns {string} - Formatted function error message
   */
  formatWithContext() {
    let message = super.formatWithContext();
    
    if (this.functionId) {
      message += `\nFunction ID: ${this.functionId}`;
    }
    
    if (this.versionId) {
      message += `\nVersion ID: ${this.versionId}`;
    }
    
    if (this.operation) {
      message += `\nOperation: ${this.operation}`;
    }
    
    return message;
  }
  
  /**
   * Get troubleshooting hints for function errors
   * 
   * @returns {string[]} - Array of troubleshooting hints
   */
  getTroubleshootingHints() {
    const hints = ['Check your function code for errors'];
    
    if (this.statusCode === 404) {
      hints.push('Verify that the function ID exists');
    } else if (this.statusCode === 429) {
      hints.push('Rate limit exceeded. Wait and try again later');
    } else if (this.statusCode >= 500) {
      hints.push('Server error. Try again later or contact support');
    } else if (this.code === 'FUNCTION_ERROR' && this.originalError) {
      hints.push(`Original error: ${this.originalError.message}`);
    }
    
    return hints;
  }
}

/**
 * Error thrown when network operations fail
 */
export class NetworkError extends GliaError {
  /**
   * Create a new NetworkError
   * 
   * @param {string} message - Error message
   * @param {object|null} details - Additional error details
   * @param {object} options - Additional options for the error
   */
  constructor(message, details = null, options = {}) {
    super(message, 'NETWORK_ERROR', details, options);
    this.name = 'NetworkError';
    
    // Extract network-specific information
    if (options && typeof options === 'object') {
      this.retryable = 
        options.statusCode === undefined || 
        options.statusCode >= 500 || 
        options.statusCode === 429;
    }
    
    if (details && typeof details === 'object' && details.originalError) {
      this.originalError = details.originalError;
    }
  }
  
  /**
   * Get troubleshooting hints for network errors
   * 
   * @returns {string[]} - Array of troubleshooting hints
   */
  getTroubleshootingHints() {
    const hints = [
      'Check your internet connection',
      'Verify the API endpoint is correct',
      'Check if the service is experiencing downtime'
    ];
    
    if (this.retryable) {
      hints.push('This error is likely temporary. Try again later');
    }
    
    if (this.statusCode === 429) {
      hints.push('You have exceeded the rate limit. Wait and try again');
    } else if (this.statusCode >= 500 && this.statusCode < 600) {
      hints.push('The server encountered an error. This is not an issue with your request');
    }
    
    return hints;
  }
}

/**
 * Error thrown when rate limits are exceeded
 */
export class RateLimitError extends NetworkError {
  /**
   * Create a new RateLimitError
   * 
   * @param {string} message - Error message
   * @param {object|null} details - Additional error details
   * @param {object} options - Additional options for the error
   */
  constructor(message, details = null, options = {}) {
    super(message, details, options);
    this.name = 'RateLimitError';
    this.code = 'RATE_LIMIT_ERROR';
    
    // Extract rate limit information
    if (options && typeof options === 'object') {
      this.retryAfter = options.retryAfter || null;
      this.limit = options.limit || null;
      this.remaining = options.remaining || 0;
      this.reset = options.reset || null;
    }
  }
  
  /**
   * Format rate limit error with additional context
   * 
   * @returns {string} - Formatted rate limit error message
   */
  formatWithContext() {
    let message = super.formatWithContext();
    
    if (this.limit !== null) {
      message += `\nLimit: ${this.limit}`;
    }
    
    if (this.remaining !== null) {
      message += `\nRemaining: ${this.remaining}`;
    }
    
    if (this.reset) {
      const resetTime = new Date(this.reset).toISOString();
      message += `\nReset Time: ${resetTime}`;
    }
    
    if (this.retryAfter) {
      message += `\nRetry After: ${this.retryAfter} seconds`;
    }
    
    return message;
  }
}
