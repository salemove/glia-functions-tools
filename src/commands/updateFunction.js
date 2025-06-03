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
    // Validate that at least one field is being updated
    if (options.name === undefined && options.description === undefined) {
      throw new Error('Please provide at least one field to update (name or description)');
    }
    
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Prepare updates object
    const updates = {};
    if (options.name !== undefined) updates.name = options.name;
    if (options.description !== undefined) updates.description = options.description;
    
    // Update function
    const updatedFunction = await api.updateFunction(options.id, updates);
    
    return updatedFunction;
  } catch (error) {
    // Don't handle errors here - propagate to caller for consistent handling
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
        // Show operation status
        command.info(`Updating function "${options.id}"...`);
        
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
        // Let the BaseCommand's error handler process this consistently with other commands
        throw error;
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default updateFunction;