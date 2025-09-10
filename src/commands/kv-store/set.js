/**
 * KV Store Set Command
 * 
 * Sets a value in the KV store
 */

import { validateKey, validateNamespace, convertValue, formatKvEntry } from './base.js';
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import { showError, showSuccess } from '../../cli/error-handler.js';
import { ValidationError } from '../../lib/errors.js';

/**
 * Set a value in the KV store
 * 
 * @param {Object} options - Command options
 * @param {string} options.namespace - KV store namespace
 * @param {string} options.key - Key to set
 * @param {string} options.value - Value to set
 * @param {boolean} [options.json] - Whether to output JSON
 * @returns {Object} - Command result
 */
export default async function setKvValue(options) {
  try {
    const { namespace, key, value, json = false } = options;
    
    // Validate input
    validateNamespace(namespace);
    validateKey(key);
    
    if (value === undefined) {
      throw new ValidationError('Value is required', { field: 'value' }, {});
    }
    
    // Convert value to appropriate type
    const convertedValue = convertValue(value);
    
    // Get API client
    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);
    
    // Set KV value
    const result = await api.setKvValue(namespace, key, convertedValue);
    
    // Format and display result
    showSuccess(
      json 
        ? JSON.stringify(result, null, 2) 
        : `Value set successfully for key '${key}' in namespace '${namespace}'.\n\n${formatKvEntry(result)}`
    );
    
    return result;
  } catch (error) {
    showError(`Failed to set KV value: ${error.message}`);
    throw error;
  }
}