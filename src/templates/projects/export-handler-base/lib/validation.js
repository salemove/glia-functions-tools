/**
 * Validation utilities for Glia export events
 * 
 * This module provides functions for validating export event payloads against schemas.
 * Enhanced with caching, detailed error messages, and support for schema versioning.
 * 
 * @version v1
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to schema directory
const SCHEMAS_DIR = path.resolve(__dirname, '../schemas');

// Schema version information
const SCHEMA_VERSION = {
  version: 'v1',
  supportsVersioning: true,
  supportedVersions: ['v1']
};

// Initialize Ajv
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
  validateSchema: true,
  validateFormats: true
});

// Add string formats like uuid, email, etc.
addFormats(ajv);

// Add the base schema for reference
const baseSchemaPath = path.join(SCHEMAS_DIR, 'base-schema.json');
if (fs.existsSync(baseSchemaPath)) {
  const baseSchema = JSON.parse(fs.readFileSync(baseSchemaPath, 'utf8'));
  ajv.addSchema(baseSchema, 'base-schema.json');
}

// Cache for compiled validators
const validators = {};

// Mapping from export_type values to schema file names
const EVENT_TYPE_TO_SCHEMA_MAP = {
  'engagement_start': 'engagement-start',
  'engagement': 'engagement-end',
  'engagement_transfer': 'engagement-transfer',
  'presence_update': 'presence-update'
};

// Export event type detection map
const EVENT_TYPE_DETECTION = {
  'engagement_start': (payload) => 
    payload?.export_type === 'engagement_start' && payload?.engagement_id && payload?.operator,
  'engagement_end': (payload) => 
    payload?.export_type === 'engagement' && payload?.engagement?.id,
  'engagement_transfer': (payload) => 
    payload?.export_type === 'engagement_transfer' && payload?.engagement_id && payload?.source && payload?.visitor,
  'presence_update': (payload) => 
    payload?.action === 'user_presence_update' && Array.isArray(payload?.events) && payload?.sent_at
};

/**
 * Load and compile a schema validator for a specific event type
 * 
 * @param {string} eventType - Type of export event
 * @param {Object} options - Validator options
 * @param {boolean} options.useCache - Whether to use cached validators
 * @param {boolean} options.allowAdditionalProperties - Whether to allow additional properties
 * @returns {Function|null} Validator function or null if schema not found
 */
function getValidator(eventType, options = {}) {
  const { 
    useCache = true, 
    allowAdditionalProperties = false 
  } = options;
  
  // Map the event type to schema name if needed
  const schemaName = EVENT_TYPE_TO_SCHEMA_MAP[eventType] || eventType;
  const cacheKey = `${schemaName}:${allowAdditionalProperties}`;
  
  // Return from cache if already compiled and cache usage is enabled
  if (useCache && validators[cacheKey]) {
    return validators[cacheKey];
  }
  
  // Try to load the schema
  const schemaPath = path.join(SCHEMAS_DIR, `${schemaName}-schema.json`);
  
  try {
    if (!fs.existsSync(schemaPath)) {
      console.error(`Schema file not found for event type ${eventType}: ${schemaPath}`);
      return null;
    }
    
    // Load and parse the schema
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);
    
    // Override additionalProperties if specified
    if (allowAdditionalProperties) {
      schema.additionalProperties = true;
    }
    
    // Compile the validator
    const validator = ajv.compile(schema);
    
    // Cache the validator if caching is enabled
    if (useCache) {
      validators[cacheKey] = validator;
    }
    
    return validator;
  } catch (error) {
    console.error(`Error loading schema for event type ${eventType}:`, error);
    return null;
  }
}

/**
 * Detect the type of export event from payload
 * 
 * @param {Object} payload - The event payload
 * @returns {string|null} The event type or null if not recognized
 */
export function detectEventType(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  
  // First check the export_type field if available
  if (payload.export_type && typeof payload.export_type === 'string') {
    return payload.export_type;
  }
  
  // Otherwise try to determine based on structure
  for (const [eventType, detector] of Object.entries(EVENT_TYPE_DETECTION)) {
    if (detector(payload)) {
      return eventType;
    }
  }
  
  return null;
}

/**
 * Validate a payload against the schema for a specific event type
 * 
 * @param {Object} payload - The payload to validate
 * @param {string} eventType - Type of export event
 * @param {Object} options - Validation options
 * @param {boolean} options.allowAdditionalProperties - Whether to allow additional properties
 * @param {boolean} options.useCache - Whether to use cached validators
 * @returns {Object} Validation result with valid flag and detailed errors
 */
export function validatePayload(payload, eventType, options = {}) {
  // Auto-detect event type if not provided
  const actualEventType = eventType || detectEventType(payload);
  
  if (!actualEventType) {
    return {
      valid: false,
      errors: [
        {
          path: '',
          message: 'Cannot detect event type from payload',
          errorType: 'unknown_event_type'
        }
      ]
    };
  }
  
  // Get the validator
  const validator = getValidator(actualEventType, options);
  
  if (!validator) {
    return {
      valid: false,
      errors: [
        {
          path: '',
          message: `No schema validator available for event type: ${actualEventType}`,
          errorType: 'missing_validator'
        }
      ]
    };
  }
  
  // Check version compatibility
  if (payload && payload.version && !SCHEMA_VERSION.supportedVersions.includes(payload.version)) {
    return {
      valid: false,
      errors: [
        {
          path: '/version',
          message: `Unsupported schema version: ${payload.version}. Supported versions are: ${SCHEMA_VERSION.supportedVersions.join(', ')}`,
          errorType: 'unsupported_version'
        }
      ]
    };
  }
  
  // Validate the payload
  const valid = validator(payload);
  
  if (valid) {
    return {
      valid: true,
      errors: []
    };
  }
  
  // Format validation errors to provide more detail
  const errors = validator.errors.map(error => {
    const path = error.instancePath || '';
    const schemaPath = error.schemaPath || '';
    const message = error.message || 'Invalid value';
    
    const result = {
      path,
      message,
      errorType: error.keyword,
      keyword: error.keyword,
      schemaPath
    };
    
    // Add more context based on error type
    if (error.keyword === 'required') {
      const property = error.params.missingProperty || '';
      result.path = `${path}/${property}`;
      result.message = `Missing required property: ${property}`;
    } else if (error.keyword === 'type') {
      result.message = `Expected ${error.params.type}, got ${typeof payload}`;
    } else if (error.keyword === 'format') {
      result.message = `Invalid format. Expected ${error.params.format}`;
    } else if (error.keyword === 'enum') {
      result.message = `Value must be one of: ${error.params.allowedValues?.join(', ')}`;
    }
    
    return result;
  });
  
  return {
    valid: false,
    errors
  };
}

/**
 * Get the schema for a specific event type
 * 
 * @param {string} eventType - Type of export event
 * @returns {Object|null} Schema object or null if not found
 */
export function getSchema(eventType) {
  // Map the event type to schema name if needed
  const schemaName = EVENT_TYPE_TO_SCHEMA_MAP[eventType] || eventType;
  const schemaPath = path.join(SCHEMAS_DIR, `${schemaName}-schema.json`);
  
  try {
    if (!fs.existsSync(schemaPath)) {
      return null;
    }
    
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    return JSON.parse(schemaContent);
  } catch (error) {
    console.error(`Error loading schema for event type ${eventType}:`, error);
    return null;
  }
}

/**
 * Get a sample payload for a specific event type
 * 
 * @param {string} eventType - Type of export event
 * @returns {Object|null} Sample payload or null if not found
 */
export function getSamplePayload(eventType) {
  // Map the event type to schema name if needed
  const schemaName = EVENT_TYPE_TO_SCHEMA_MAP[eventType] || eventType;
  const samplePath = path.join(SCHEMAS_DIR, `${schemaName}-sample.json`);
  
  try {
    if (!fs.existsSync(samplePath)) {
      return null;
    }
    
    const sampleContent = fs.readFileSync(samplePath, 'utf8');
    return JSON.parse(sampleContent);
  } catch (error) {
    console.error(`Error loading sample payload for event type ${eventType}:`, error);
    return null;
  }
}

/**
 * Get the schema version information
 * 
 * @returns {Object} Schema version information
 */
export function getSchemaVersion() {
  return { ...SCHEMA_VERSION };
}

/**
 * Clear the validator cache
 * 
 * @returns {void}
 */
export function clearValidatorCache() {
  Object.keys(validators).forEach(key => {
    delete validators[key];
  });
}

export default {
  validatePayload,
  detectEventType,
  getSchema,
  getSamplePayload,
  getSchemaVersion,
  clearValidatorCache
};