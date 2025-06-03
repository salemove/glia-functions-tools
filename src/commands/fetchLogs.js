/**
 * Command to fetch logs for a function
 *
 * This command retrieves logs for a specified function
 */
import fs from 'fs/promises';
import { getApiConfig } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';
import BaseCommand from '../cli/base-command.js';

/**
 * Fetch all logs for a function by following pagination
 * 
 * @param {Object} api - GliaApiClient instance
 * @param {string} functionId - Function ID
 * @param {Object} logsOptions - Logs filtering options
 * @param {boolean} showProgress - Whether to show progress information
 * @param {BaseCommand} [command] - BaseCommand instance for logging (optional)
 * @returns {Promise<Array>} All log entries
 */
async function fetchAllLogs(api, functionId, logsOptions, showProgress, command) {
  let allLogs = [];
  let nextPage = null;
  let pageCount = 0;
  
  // Initial fetch
  const initialResult = await api.getFunctionLogs(functionId, logsOptions);
  
  // Add logs from first page
  if (initialResult.logs && initialResult.logs.length > 0) {
    allLogs = [...initialResult.logs];
  }
  
  // Check if there are more pages
  nextPage = initialResult.next_page;
  pageCount = 1;

  if (showProgress && command) {
    command.info(`Fetched page ${pageCount} with ${initialResult.logs ? initialResult.logs.length : 0} entries...`);
  }
  
  // Follow pagination and collect all logs
  while (nextPage) {
    // Use absolute URL for next page as provided by the API
    const nextPageResult = await api.makeRequest(nextPage, {}, {
      useCache: false, // Don't cache pagination requests
      useRetry: true   // But do retry if needed
    });
    
    pageCount++;
    
    if (showProgress && command) {
      command.info(`Fetched page ${pageCount} with ${nextPageResult.logs ? nextPageResult.logs.length : 0} entries...`);
    }
    
    // Add logs from this page
    if (nextPageResult.logs && nextPageResult.logs.length > 0) {
      allLogs = [...allLogs, ...nextPageResult.logs];
    }
    
    // Update next page URL for next iteration
    nextPage = nextPageResult.next_page;
  }
  
  return allLogs;
}

/**
 * Fetch logs for a function
 * 
 * @param {Object} options - Command options
 * @param {string} options.functionId - Function ID
 * @param {Object} options.logsOptions - Logs filtering options
 * @param {string} options.outputPath - Path to save logs (optional)
 * @param {boolean} options.fetchAll - Whether to fetch all logs (follow pagination)
 * @param {BaseCommand} [options.command] - BaseCommand instance for logging (optional)
 * @returns {Promise<Object>} Logs data
 */
export async function fetchLogs(options) {
  try {
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    let result;
    
    if (options.fetchAll) {
      // Fetch all pages of logs
      const allLogs = await fetchAllLogs(
        api, 
        options.functionId, 
        options.logsOptions, 
        true, 
        options.command
      );
      
      result = {
        logs: allLogs,
        next_page: null // No more pages to fetch
      };
    } else {
      // Fetch just the first page
      result = await api.getFunctionLogs(options.functionId, options.logsOptions);
    }
    
    // Write to file if specified
    if (options.outputPath) {
      await fs.writeFile(options.outputPath, JSON.stringify(result, null, 2));
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('fetch-logs', 'Fetch logs for a function')
    .requiredOption('--function-id <id>', 'Function ID')
    .option('--limit <count>', 'Maximum number of logs to retrieve per page', 100)
    .option('--start-time <time>', 'Start time for logs (ISO 8601 format)')
    .option('--end-time <time>', 'End time for logs (ISO 8601 format)')
    .option('--output <path>', 'File path to save logs', './logs.json')
    .option('--all', 'Fetch all logs (follows pagination)', false)
    .action(async (options) => {
      command.info(`Fetching logs for function ${options.functionId}...`);
      
      const result = await fetchLogs({
        functionId: options.functionId,
        logsOptions: {
          limit: parseInt(options.limit, 10),
          startTime: options.startTime,
          endTime: options.endTime
        },
        outputPath: options.output,
        fetchAll: options.all,
        command: command // Pass command for progress reporting
      });
      
      if (options.output) {
        command.success(`Logs saved to ${options.output}`);
      }
      
      if (!result.logs || result.logs.length === 0) {
        command.info('No logs found for this function.');
        return;
      }
      
      command.info(`Found ${result.logs.length} log entries.`);
      
      // Check if the results might be truncated and there were more logs
      if (!options.all && result.next_page) {
        command.info(`Note: These are only the first ${result.logs.length} logs. Use --all flag to fetch all logs.`);
      }
      
      // Only display the first 100 logs in the table to avoid console overload
      const displayLimit = 100;
      if (result.logs.length > displayLimit) {
        command.info(`Showing first ${displayLimit} entries in the table. All logs are saved in the output file.`);
        
        // Format logs as a table (limited to displayLimit)
        const tableData = result.logs.slice(0, displayLimit).map(log => ({
          'Timestamp': new Date(log.timestamp).toLocaleString(),
          'Message': log.message
        }));
        
        console.log(command.formatTable(tableData));
      } else {
        // Format all logs as a table
        const tableData = result.logs.map(log => ({
          'Timestamp': new Date(log.timestamp).toLocaleString(),
          'Message': log.message
        }));
        
        console.log(command.formatTable(tableData));
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default fetchLogs;
