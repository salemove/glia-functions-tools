/**
 * KV Store Test-and-Set Command
 * 
 * Conditionally updates a value in the KV store
 */

import { validateKey, validateNamespace, convertValue, formatKvEntry } from './base.js';
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import { showError, showSuccess, showWarning } from '../../cli/error-handler.js';
import { ValidationError } from '../../lib/errors.js';

/**
 * Test and set a value in the KV store (conditional update)
 * 
 * @param {Object} options - Command options
 * @param {string} options.namespace - KV store namespace
 * @param {string} options.key - Key to update
 * @param {string} options.oldValue - Expected current value
 * @param {string} options.newValue - New value to set
 * @param {boolean} [options.json] - Whether to output JSON
 * @returns {Object} - Command result
 */
export default async function testAndSetKvValue(options) {
  try {
    const { namespace, key, oldValue, newValue, json = false } = options;
    
    // Validate input
    validateNamespace(namespace);
    validateKey(key);
    
    if (oldValue === undefined) {
      throw new ValidationError('Old value is required', { field: 'oldValue' }, {});
    }
    
    if (newValue === undefined) {
      throw new ValidationError('New value is required', { field: 'newValue' }, {});
    }
    
    // Convert values to appropriate types
    const convertedOldValue = convertValue(oldValue);
    const convertedNewValue = convertValue(newValue);
    
    // Get API client
    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);
    
    // Test and set KV value
    const result = await api.testAndSetKvValue(namespace, key, convertedOldValue, convertedNewValue);
    
    // Check if the condition was met
    if (!result || result.value === null) {
      showWarning(
        json 
          ? JSON.stringify({ success: false, conditionMet: false, key }, null, 2) 
          : `Condition not met for key '${key}'. Value was not updated.`
      );
      return { success: false, conditionMet: false, key };
    }
    
    // Format and display successful result
    showSuccess(
      json 
        ? JSON.stringify({ ...result, success: true, conditionMet: true }, null, 2) 
        : `Value conditionally updated for key '${key}' in namespace '${namespace}'.\n\n${formatKvEntry(result)}`
    );
    
    return { ...result, success: true, conditionMet: true };
  } catch (error) {
    showError(`Failed to conditionally update KV value: ${error.message}`);
    throw error;
  }
}