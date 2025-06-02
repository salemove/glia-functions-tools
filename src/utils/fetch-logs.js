/**
 * DEPRECATED: This module provides backward compatibility with the old fetchGfLogs function.
 * It is recommended to use the fetchLogs command from src/commands/fetchLogs.js instead.
 * 
 * This implementation uses the GliaApiClient to correctly handle pagination and API responses.
 */

import { getApiConfig } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';

/**
 * Fetch all logs for a function
 * 
 * @param {string} functionId - Function ID
 * @returns {Promise<Array>} - Array of log entries
 */
const fetchGfLogs = async (functionId) => {
  console.warn(
    'Warning: fetchGfLogs from utils is deprecated and will be removed in a future version. ' +
    'Please use the fetchLogs command from src/commands/fetchLogs.js instead.'
  );
  
  try {
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Use the fetchAllLogs functionality from the commands implementation
    // but adapt it to match the old API's return format
    let allLogs = [];
    let nextPage = null;
    
    // Initial fetch
    const initialResult = await api.getFunctionLogs(functionId, {});
    
    // Add logs from first page
    if (initialResult.logs && initialResult.logs.length > 0) {
      allLogs = [...initialResult.logs];
    }
    
    // Check if there are more pages
    nextPage = initialResult.next_page;
    
    // Follow pagination and collect all logs
    while (nextPage) {
      // Use absolute URL for next page as provided by the API
      const nextPageResult = await api.makeRequest(nextPage, {}, {
        useCache: false, // Don't cache pagination requests
        useRetry: true   // But do retry if needed
      });
      
      // Add logs from this page
      if (nextPageResult.logs && nextPageResult.logs.length > 0) {
        allLogs = [...allLogs, ...nextPageResult.logs];
      }
      
      // Update next page URL for next iteration
      nextPage = nextPageResult.next_page;
    }
    
    // Sort logs by timestamp (to match the behavior of the old implementation)
    return allLogs.sort((a, b) => {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
};

export default fetchGfLogs;
