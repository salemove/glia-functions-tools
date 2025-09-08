/**
 * KV Store Delete Command
 * 
 * Deletes a value from the KV store
 */

import { validateKey, validateNamespace } from './base.js';
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import { showError, showSuccess } from '../../cli/error-handler.js';

/**
 * Delete a value from the KV store
 * 
 * @param {Object} options - Command options
 * @param {string} options.namespace - KV store namespace
 * @param {string} options.key - Key to delete
 * @param {boolean} [options.json] - Whether to output JSON
 * @returns {Object} - Command result
 */
export default async function deleteKvValue(options) {
  try {
    const { namespace, key, json = false } = options;
    
    // Validate input
    validateNamespace(namespace);
    validateKey(key);
    
    // Get API client
    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);
    
    // Delete KV value
    const result = await api.deleteKvValue(namespace, key);
    
    // Format and display result
    showSuccess(
      json 
        ? JSON.stringify(result, null, 2) 
        : `Key '${key}' deleted successfully from namespace '${namespace}'.`
    );
    
    return result;
  } catch (error) {
    showError(`Failed to delete KV value: ${error.message}`);
    throw error;
  }
}