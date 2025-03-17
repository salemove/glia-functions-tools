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
 * Fetch logs for a function
 * 
 * @param {Object} options - Command options
 * @param {string} options.functionId - Function ID
 * @param {Object} options.logsOptions - Logs filtering options
 * @param {string} options.outputPath - Path to save logs (optional)
 * @returns {Promise<Object>} Logs data
 */
export async function fetchLogs(options) {
  try {
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Fetch logs
    const logs = await api.getFunctionLogs(options.functionId, options.logsOptions);
    
    // Write to file if specified
    if (options.outputPath) {
      await fs.writeFile(options.outputPath, JSON.stringify(logs, null, 2));
    }
    
    return logs;
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
    .option('--limit <count>', 'Maximum number of logs to retrieve', 100)
    .option('--start-time <time>', 'Start time for logs (ISO 8601 format)')
    .option('--end-time <time>', 'End time for logs (ISO 8601 format)')
    .option('--output <path>', 'File path to save logs', './logs.json')
    .action(async (options) => {
      command.info(`Fetching logs for function ${options.functionId}...`);
      
      const result = await fetchLogs({
        functionId: options.functionId,
        logsOptions: {
          limit: parseInt(options.limit, 10),
          startTime: options.startTime,
          endTime: options.endTime
        },
        outputPath: options.output
      });
      
      if (options.output) {
        command.success(`Logs saved to ${options.output}`);
      }
      
      if (!result.logs || result.logs.length === 0) {
        command.info('No logs found for this function.');
        return;
      }
      
      command.info(`Found ${result.logs.length} log entries:`);
      
      // Format logs as a table
      const tableData = result.logs.map(log => ({
        'Timestamp': new Date(log.timestamp).toLocaleString(),
        'Message': log.message
      }));
      
      console.log(command.formatTable(tableData));
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default fetchLogs;
