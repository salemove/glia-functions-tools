/**
 * KV Store Get Command
 * 
 * Retrieves a value from the KV store
 */

import { validateKey, validateNamespace, formatKvEntry } from './base.js';
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import BaseCommand from '../../cli/base-command.js';
import { showError, showSuccess, showInfo } from '../../cli/error-handler.js';

/**
 * Get a value from the KV store
 * 
 * @param {Object} options - Command options
 * @param {string} options.namespace - KV store namespace
 * @param {string} options.key - Key to get
 * @param {boolean} [options.json] - Whether to output JSON
 * @returns {Object} - Command result
 */
export default async function getKvValue(options) {
  try {
    const { namespace, key, json = false } = options;
    
    // Validate input
    validateNamespace(namespace);
    validateKey(key);
    
    // Get API client
    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);
    
    // Get KV value
    const result = await api.getKvValue(namespace, key);
    
    // Format and display result
    if (!result || result.value === null) {
      if (json) {
        showInfo(JSON.stringify({ found: false, key }, null, 2));
      } else {
        showInfo(`Key '${key}' not found in namespace '${namespace}'`);
      }
      return { found: false, key };
    }
    
    showSuccess(formatKvEntry(result, { json }));
    
    return result;
  } catch (error) {
    showError(`Failed to get KV value: ${error.message}`);
    throw error;
  }
}