/**
 * Command to delete a scheduled trigger
 */
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import BaseCommand from '../../cli/base-command.js';

/**
 * Delete a scheduled trigger
 *
 * @param {Object} options - Command options
 * @param {string} options.id - Trigger ID to delete
 * @returns {Promise<void>}
 */
export async function deleteSchedule(options) {
  try {
    if (!options.id) {
      throw new Error('Trigger ID is required');
    }

    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);

    await api.deleteScheduledTrigger(options.id);
    return { success: true };
  } catch (error) {
    throw error;
  }
}

async function main() {
  const command = new BaseCommand('delete-schedule', 'Delete a scheduled trigger')
    .requiredOption('--id <id>', 'Trigger ID to delete')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        command.warning(`You are about to delete scheduled trigger ${options.id}`);
        command.warning('This action cannot be undone!');

        if (!options.yes) {
          const { confirm } = await import('@inquirer/prompts');
          const shouldDelete = await confirm({
            message: 'Are you sure you want to delete this scheduled trigger?',
            default: false
          });

          if (!shouldDelete) {
            command.info('Scheduled trigger deletion cancelled');
            return;
          }
        }

        command.info(`Deleting scheduled trigger "${options.id}"...`);

        await deleteSchedule({ id: options.id });

        command.success(`Scheduled trigger "${options.id}" deleted successfully`);
      } catch (error) {
        throw error;
      }
    });

  command.parse(process.argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default deleteSchedule;
