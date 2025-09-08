/**
 * Filtering utilities for handling sensitive data
 * 
 * This module provides functions for filtering out PII and other sensitive data
 * from export event payloads.
 */

import { logger } from './logging.js';

/**
 * Fields considered to contain PII data
 */
const PII_FIELDS = [
  'email',
  'name',
  'phone',
  'first_name',
  'last_name',
  'address',
  'postal_code',
  'zip_code',
  'city',
  'state',
  'country',
  'date_of_birth',
  'ssn',
  'social_security_number',
  'credit_card',
  'password'
];

/**
 * Fields that should never be filtered (safe to keep)
 */
const SAFE_FIELDS = [
  'id',
  'visitor_id',
  'site_id',
  'queue_id',
  'queue_name',
  'group_id',
  'group_name',
  'engagement_id',
  'engagement_type',
  'status',
  'created_at',
  'updated_at',
  'ended_at',
  'transfer_time'
];

/**
 * Check if a field name appears to contain PII
 * 
 * @param {string} fieldName - Name of the field
 * @returns {boolean} True if the field potentially contains PII
 */
export function isPIIField(fieldName) {
  // Check if field is explicitly in the safe list
  if (SAFE_FIELDS.includes(fieldName)) {
    return false;
  }
  
  // Check if field matches any PII field names
  return PII_FIELDS.some(piiField => 
    fieldName === piiField || 
    fieldName.includes(piiField) || 
    piiField.includes(fieldName)
  );
}

/**
 * Filter sensitive data from an object
 * 
 * @param {Object} data - Data to filter
 * @returns {Object} Filtered data
 */
export function filterSensitiveData(data) {
  // Handle null or undefined
  if (data === null || data === undefined) {
    return data;
  }
  
  // Handle non-objects
  if (typeof data !== 'object') {
    return data;
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => filterSensitiveData(item));
  }
  
  // Create a new object for the filtered data
  const filtered = {};
  
  // Process each property
  for (const [key, value] of Object.entries(data)) {
    // Special handling for visitor object
    if (key === 'visitor' && value && typeof value === 'object') {
      filtered[key] = filterVisitorData(value);
      continue;
    }
    
    // Skip PII fields
    if (isPIIField(key)) {
      logger.debug(`Filtering PII field: ${key}`);
      continue;
    }
    
    // Recursively filter objects
    if (value && typeof value === 'object') {
      filtered[key] = filterSensitiveData(value);
    } else {
      filtered[key] = value;
    }
  }
  
  return filtered;
}

/**
 * Filter visitor data with special handling for custom attributes
 * 
 * @param {Object} visitorData - Visitor data object
 * @returns {Object} Filtered visitor data
 */
function filterVisitorData(visitorData) {
  if (!visitorData || typeof visitorData !== 'object') {
    return {};
  }
  
  const filtered = {};
  
  // Keep only safe fields and custom attributes
  for (const [key, value] of Object.entries(visitorData)) {
    if (key === 'custom_attributes' && value && typeof value === 'object') {
      // Only keep non-PII custom attributes
      const safeCustomAttrs = {};
      
      for (const [attrKey, attrValue] of Object.entries(value)) {
        if (!isPIIField(attrKey)) {
          safeCustomAttrs[attrKey] = attrValue;
        }
      }
      
      filtered.custom_attributes = safeCustomAttrs;
    } else if (!isPIIField(key)) {
      // Keep non-PII fields
      filtered[key] = value;
    }
  }
  
  return filtered;
}

export default {
  filterSensitiveData,
  isPIIField
};