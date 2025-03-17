/**
 * Command to invoke a function
 *
 * This command invokes a function with the specified payload
 */
import { parseAndValidateJson } from '../lib/validation.js';
import { getApiConfig } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';
import BaseCommand from '../cli/base-command.js';

/**
 * Invoke a function
 * 
 * @param {Object} options - Command options
 * @param {string} options.invocationUri - Function invocation URI
 * @param {Object|string} options.payload - Function payload
 * @returns {Promise<Object>} Function response
 */
export async function invokeFunction(options) {
  try {
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Invoke function
    const response = await api.invokeFunction(options.invocationUri, options.payload);
    
    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('invoke-function', 'Invoke a function with the specified payload')
    .requiredOption('--uri <uri>', 'Function invocation URI')
    .option('--payload <data>', 'JSON payload for the function', '{}')
    .action(async (options) => {
      // Parse payload
      let payload;
      try {
        payload = parseAndValidateJson(options.payload);
      } catch (error) {
        command.error(`Invalid JSON payload: ${error.message}`);
        process.exit(1);
      }
      
      command.info(`Invoking function at ${options.uri}...`);
      
      const response = await invokeFunction({
        invocationUri: options.uri,
        payload
      });
      
      command.success('Function invoked successfully');
      command.info('Response:');
      console.log(command.formatJson(response));
      
      // If the response contains an error, show a warning
      if (response.error) {
        command.warning(`Function returned an error: ${response.error}`);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default invokeFunction;
