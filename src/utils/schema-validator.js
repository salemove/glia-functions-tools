/**
 * Schema validator for Glia Functions CLI
 * 
 * This module provides a JSON schema validator using Ajv
 */
import Ajv from 'ajv';

// Create Ajv instance with options
const ajv = new Ajv({
  allErrors: true,  // Report all errors, not just the first one
  verbose: true,    // Include schema path in errors
  strictTypes: false, // Less strict type checking for better user experience
  strictRequired: false // Less strict handling of required properties
});

/**
 * Validate data against a schema
 * 
 * @param {Object} data - Data to validate
 * @param {Object} schema - Schema to validate against
 * @returns {Object} Validation result with valid flag and errors array
 */
export function validate(data, schema) {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  
  if (!valid) {
    const errors = formatErrors(validate.errors);
    return {
      valid: false,
      errors
    };
  }
  
  return {
    valid: true,
    errors: []
  };
}

/**
 * Format validation errors to be more user-friendly
 * 
 * @param {Array} errors - Ajv error objects
 * @returns {Array<string>} Formatted error messages
 */
function formatErrors(errors) {
  return errors.map(error => {
    // Format error path for better readability
    const path = error.instancePath ? 
      error.instancePath.replace(/^\//, '').replace(/\//g, '.') : 
      'root';
    
    // Handle specific error types
    switch (error.keyword) {
      case 'required':
        return `${path} is missing required property: ${error.params.missingProperty}`;
      
      case 'type':
        return `${path} should be a ${error.params.type}`;
      
      case 'enum':
        return `${path} must be one of: ${error.params.allowedValues.join(', ')}`;
      
      case 'additionalProperties':
        return `${path} has unexpected property: ${error.params.additionalProperty}`;
      
      default:
        return `${path}: ${error.message}`;
    }
  });
}

export default { validate };