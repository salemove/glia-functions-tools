/**
 * Command to list all functions
 *
 * This command lists all functions available for the site
 */
import { getApiConfig } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';
import BaseCommand from '../cli/base-command.js';

/**
 * List all functions
 * 
 * @param {Object} options - Command options
 * @param {boolean} options.detailed - Whether to show detailed output
 * @returns {Promise<Object>} Functions list
 */
export async function listFunctions(options = {}) {
  try {
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // List functions
    const functions = await api.listFunctions();
    
    return functions;
  } catch (error) {
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('list-functions', 'List all available functions')
    .option('-d, --detailed', 'Show detailed output', false)
    .action(async (options) => {
      const result = await listFunctions({
        detailed: options.detailed
      });
      
      if (result.functions.length === 0) {
        command.info('No functions found.');
        return;
      }
      
      if (options.detailed) {
        command.info('Functions (detailed):');
        console.log(command.formatJson(result));
      } else {
        command.info(`Found ${result.functions.length} functions:`);
        
        // Format as a simple table
        const tableData = result.functions.map(fn => ({
          'ID': fn.id,
          'Name': fn.name,
          'Description': fn.description || '(No description)'
        }));
        
        console.log(command.formatTable(tableData, ['ID', 'Name', 'Description']));
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default listFunctions;
