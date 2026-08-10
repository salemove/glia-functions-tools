/**
 * KV Store base utilities
 * 
 * Common functions for KV Store command implementations
 */

// Namespace and key validation lives with the API client, so the rules from the
// spec (charset as well as byte length) are defined in exactly one place.
export { validateKvKey as validateKey, validateKvNamespace as validateNamespace }
  from '../../lib/api.js';

/**
 * Interpret a value supplied on the command line.
 *
 * KV values are strings; the spec has no boolean type. The previous version
 * turned "true" and "false" into booleans and sent them, which is why a value of
 * "true" came back as something else. Only the literal "null" is special, and
 * only where a null is meaningful: as an absent value in test-and-set.
 *
 * @param {string} value - Raw value from the command line
 * @param {Object} [options] - Interpretation options
 * @param {boolean} [options.allowNull] - Treat "null" as an absent value
 * @returns {string|null} The value to send
 */
export function convertValue(value, { allowNull = false } = {}) {
  if (allowNull && (value === 'null' || value === undefined)) {
    return null;
  }
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
    // `formatted` must not be called displayValue: a const of that name shadowed
    // the imported function and was read on the line above its own
    // initialisation, so this threw a TDZ error for every non-empty list.
    const value = displayValue(item.value);
    const formatted = value.length > 35 ? value.substring(0, 32) + '...' : value.padEnd(35);
    const expires = item.expires ? new Date(item.expires).toLocaleString() : 'N/A';
    
    output += `${key} ${formatted} ${expires}\n`;
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