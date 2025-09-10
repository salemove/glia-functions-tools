/**
 * KV Store List Command
 * 
 * Lists all key-value pairs in a namespace
 */

import { validateNamespace, formatKvEntries } from './base.js';
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import { showError, showSuccess, showInfo } from '../../cli/error-handler.js';

/**
 * List key-value pairs in a namespace
 * 
 * @param {Object} options - Command options
 * @param {string} options.namespace - KV store namespace
 * @param {boolean} [options.json] - Whether to output JSON
 * @param {boolean} [options.all] - Whether to fetch all pages
 * @param {number} [options.limit] - Maximum number of items to fetch per page
 * @returns {Object} - Command result
 */
export default async function listKvPairs(options) {
  try {
    const { namespace, json = false, all = false, limit } = options;
    
    // Validate input
    validateNamespace(namespace);
    
    // Get API client
    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);
    
    // Prepare API options
    const apiOptions = {
      limit: limit ? parseInt(limit, 10) : undefined,
      fetchAll: all
    };
    
    // List KV pairs
    const result = await api.listKvPairs(namespace, apiOptions);
    
    // Format and display result
    if (!result.items || result.items.length === 0) {
      showInfo(
        json 
          ? JSON.stringify({ items: [], total_count: 0 }, null, 2) 
          : `No KV pairs found in namespace '${namespace}'.`
      );
      return { items: [], total_count: 0 };
    }
    
    // Show pagination info if not fetching all
    if (!all && result.next_page_cursor) {
      const message = `\nShowing ${result.items.length} of ${result.total_count || 'many'} items. ` +
                      `Use --all to fetch all items or provide --cursor "${result.next_page_cursor}" for the next page.`;
      
      if (!json) {
        showInfo(message);
      }
    }
    
    // Show formatted results
    showSuccess(
      json 
        ? JSON.stringify(result, null, 2) 
        : formatKvEntries(result.items, { json })
    );
    
    return result;
  } catch (error) {
    showError(`Failed to list KV pairs: ${error.message}`);
    throw error;
  }
}