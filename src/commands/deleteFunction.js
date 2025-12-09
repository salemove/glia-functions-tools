/**
 * Command to delete a function
 *
 * This command deletes an existing Glia Function
 */
import { getApiConfig } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';
import BaseCommand from '../cli/base-command.js';

/**
 * Delete a function
 *
 * @param {Object} options - Command options
 * @param {string} options.id - Function ID to delete
 * @param {boolean} [options.confirm] - Skip confirmation prompt
 * @returns {Promise<void>}
 */
export async function deleteFunction(options) {
  try {
    // Validation
    if (!options.id) {
      throw new Error('Function ID is required');
    }

    // Get API configuration
    const apiConfig = await getApiConfig();

    // Create API client
    const api = new GliaApiClient(apiConfig);

    // Delete the function
    await api.deleteFunction(options.id);

    return { success: true };
  } catch (error) {
    // Don't handle errors here - propagate to caller for consistent handling
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('delete-function', 'Delete a function')
    .requiredOption('--id <id>', 'Function ID to delete')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        // Show warning
        command.warning(`You are about to delete function ${options.id}`);
        command.warning('This action cannot be undone!');

        // Confirm deletion unless --yes flag is passed
        if (!options.yes) {
          const { confirm } = await import('@inquirer/prompts');
          const shouldDelete = await confirm({
            message: 'Are you sure you want to delete this function?',
            default: false
          });

          if (!shouldDelete) {
            command.info('Function deletion cancelled');
            return;
          }
        }

        // Show operation status
        command.info(`Deleting function "${options.id}"...`);

        // Delete the function
        await deleteFunction({
          id: options.id,
          confirm: options.yes
        });

        // Display success message
        command.success(`Function "${options.id}" deleted successfully`);
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

export default deleteFunction;
