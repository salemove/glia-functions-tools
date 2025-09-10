/**
 * KV Store base utilities
 * 
 * Common functions for KV Store command implementations
 */

import { ValidationError } from '../../lib/errors.js';

/**
 * Validate KV store key format
 * 
 * @param {string} key - The key to validate
 * @throws {ValidationError} - If key is invalid
 */
export function validateKey(key) {
  if (!key) {
    throw new ValidationError('Key is required', { field: 'key' }, {});
  }
  
  const keyBytes = Buffer.from(key).length;
  if (keyBytes > 512) {
    throw new ValidationError(
      'Key exceeds maximum length of 512 bytes', 
      { field: 'key', length: keyBytes }, 
      {}
    );
  }
}

/**
 * Validate KV store namespace format
 * 
 * @param {string} namespace - The namespace to validate
 * @throws {ValidationError} - If namespace is invalid
 */
export function validateNamespace(namespace) {
  if (!namespace) {
    throw new ValidationError('Namespace is required', { field: 'namespace' }, {});
  }
  
  const namespaceBytes = Buffer.from(namespace).length;
  if (namespaceBytes > 128) {
    throw new ValidationError(
      'Namespace exceeds maximum length of 128 bytes', 
      { field: 'namespace', length: namespaceBytes }, 
      {}
    );
  }
}

/**
 * Convert string value to appropriate type (boolean or string)
 * 
 * @param {string} value - The value to convert
 * @returns {string|boolean} - Converted value
 */
export function convertValue(value) {
  // Handle boolean values
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  
  // Return as string for all other cases
  return value;
}

/**
 * Format value for display in CLI output
 * 
 * @param {any} value - The value to format
 * @returns {string} - Formatted value for display
 */
export function displayValue(value) {
  // Handle null value
  if (value === null) {
    return 'null';
  }
  
  // Handle boolean values
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  
  // Handle object values (try to stringify)
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return `[Object: ${typeof value}]`;
    }
  }
  
  // Return as string for all other cases
  return String(value);
}

/**
 * Format KV store entries for display
 * 
 * @param {Array} items - KV store entries
 * @param {Object} options - Format options
 * @param {boolean} options.json - Whether to return JSON format
 * @returns {string} - Formatted output
 */
export function formatKvEntries(items, options = {}) {
  // JSON format
  if (options.json) {
    return JSON.stringify(items, null, 2);
  }
  
  // No items
  if (!items || items.length === 0) {
    return 'No KV entries found.';
  }
  
  // Table format
  let output = 'KEY                                  VALUE                                 EXPIRES\n';
  output += '--------------------------------------------------------------------------------\n';
  
  items.forEach(item => {
    const key = item.key.length > 35 ? item.key.substring(0, 32) + '...' : item.key.padEnd(35);
    const value = displayValue(item.value);
    const displayValue = value.length > 35 ? value.substring(0, 32) + '...' : value.padEnd(35);
    const expires = item.expires ? new Date(item.expires).toLocaleString() : 'N/A';
    
    output += `${key} ${displayValue} ${expires}\n`;
  });
  
  return output;
}

/**
 * Format a single KV entry for display
 * 
 * @param {Object} item - KV store entry
 * @param {Object} options - Format options
 * @param {boolean} options.json - Whether to return JSON format
 * @returns {string} - Formatted output
 */
export function formatKvEntry(item, options = {}) {
  // JSON format
  if (options.json) {
    return JSON.stringify(item, null, 2);
  }
  
  // No item
  if (!item) {
    return 'Entry not found.';
  }
  
  // Detail format
  let output = '';
  output += `Key:     ${item.key}\n`;
  output += `Value:   ${displayValue(item.value)}\n`;
  output += `Expires: ${item.expires ? new Date(item.expires).toLocaleString() : 'N/A'}\n`;
  
  return output;
}