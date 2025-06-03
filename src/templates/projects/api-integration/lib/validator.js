/**
 * Validator for {{projectName}}
 * 
 * Handles input validation for API requests
 */

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'INVALID_INPUT';
  }
}

/**
 * Validate the input payload
 * 
 * @param {Object} payload - Input payload to validate
 * @throws {ValidationError} If validation fails
 */
export function validateInput(payload) {
  // Check if payload is defined
  if (!payload) {
    throw new ValidationError('Payload is required');
  }
  
  // Check required fields
  if (!payload.query) {
    throw new ValidationError('Missing required field: query');
  }
  
  // Validate query format
  if (typeof payload.query !== 'string' || payload.query.trim().length === 0) {
    throw new ValidationError('Query must be a non-empty string');
  }
  
  // Validate optional fields
  if (payload.limit !== undefined) {
    if (typeof payload.limit !== 'number' || payload.limit <= 0 || payload.limit > 100) {
      throw new ValidationError('Limit must be a number between 1 and 100');
    }
  }
  
  if (payload.offset !== undefined) {
    if (typeof payload.offset !== 'number' || payload.offset < 0) {
      throw new ValidationError('Offset must be a non-negative number');
    }
  }
  
  // Validation successful (no errors thrown)
  return true;
}