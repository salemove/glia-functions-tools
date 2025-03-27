/**
 * Command to update a function's name and description
 *
 * This command updates an existing Glia Function's name and/or description.
 */
import { getApiConfig } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';
import BaseCommand from '../cli/base-command.js';

/**
 * Update a function's details
 * 
 * @param {Object} options - Command options
 * @param {string} options.id - Function ID
 * @param {string} [options.name] - New function name
 * @param {string} [options.description] - New function description
 * @returns {Promise<Object>} Updated function details
 */
export async function updateFunction(options) {
  try {
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Prepare updates object
    const updates = {};
    if (options.name !== undefined) updates.name = options.name;
    if (options.description !== undefined) updates.description = options.description;
    
    // Update function
    console.log(`Updating function "${options.id}"...`);
    const updatedFunction = await api.updateFunction(options.id, updates);
    console.log('Function updated:', updatedFunction);
    
    return updatedFunction;
  } catch (error) {
    console.error('Error updating function:', error);
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('update-function', 'Update a function\'s name and description')
    .requiredOption('--id <id>', 'Function ID')
    .option('--name <name>', 'New function name')
    .option('--description <description>', 'New function description')
    .action(async (options) => {
      try {
        // Validate that at least one update field is provided
        if (options.name === undefined && options.description === undefined) {
          command.error('Please provide at least one field to update (--name or --description)');
          return;
        }
        
        // Update the function
        const result = await updateFunction({
          id: options.id,
          name: options.name,
          description: options.description
        });
        
        // Display success message
        command.success(`Function "${result.id}" updated successfully`);
        
        // Show the updated values
        if (options.name !== undefined) {
          command.info(`Name: ${result.name}`);
        }
        if (options.description !== undefined) {
          command.info(`Description: ${result.description}`);
        }
      } catch (error) {
        command.error(`Failed to update function: ${error.message}`);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default updateFunction;