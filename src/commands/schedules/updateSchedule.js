/**
 * Command to update a scheduled trigger
 */
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import BaseCommand from '../../cli/base-command.js';
import { validateCronExpression, parseCronExpression } from '../../utils/cron-helper.js';

/**
 * Update a scheduled trigger
 *
 * @param {Object} options - Command options
 * @param {string} options.id - Trigger ID
 * @param {string} [options.name] - New name
 * @param {string} [options.description] - New description
 * @param {string} [options.schedulePattern] - New schedule pattern
 * @param {boolean} [options.enabled] - Enable/disable
 * @returns {Promise<Object>} Updated trigger details
 */
export async function updateSchedule(options) {
  try {
    if (!options.id) {
      throw new Error('Trigger ID is required');
    }

    // Validate cron expression if provided
    if (options.schedulePattern) {
      const validation = validateCronExpression(options.schedulePattern);
      if (!validation.valid) {
        throw new Error(`Invalid cron expression: ${validation.error}`);
      }
    }

    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);

    const updates = {};
    if (options.name !== undefined) updates.name = options.name;
    if (options.description !== undefined) updates.description = options.description;
    if (options.schedulePattern !== undefined) updates.schedulePattern = options.schedulePattern;
    if (options.enabled !== undefined) updates.enabled = options.enabled;

    const result = await api.updateScheduledTrigger(options.id, updates);
    return result;
  } catch (error) {
    throw error;
  }
}

async function main() {
  const command = new BaseCommand('update-schedule', 'Update a scheduled trigger')
    .requiredOption('--id <id>', 'Trigger ID')
    .option('--name <name>', 'New trigger name')
    .option('--description <description>', 'New description')
    .option('--schedule <pattern>', 'New cron expression')
    .option('--enable', 'Enable the trigger')
    .option('--disable', 'Disable the trigger')
    .action(async (options) => {
      try {
        command.info(`Updating scheduled trigger "${options.id}"...`);

        const enabled = options.enable ? true : (options.disable ? false : undefined);

        const result = await updateSchedule({
          id: options.id,
          name: options.name,
          description: options.description,
          schedulePattern: options.schedule,
          enabled
        });

        command.success(`Scheduled trigger "${result.name}" updated successfully`);
        if (result.schedule_pattern) {
          command.info(`Schedule: ${parseCronExpression(result.schedule_pattern)}`);
        }
        command.info(`Status: ${result.enabled ? 'Enabled' : 'Disabled'}`);
      } catch (error) {
        throw error;
      }
    });

  command.parse(process.argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default updateSchedule;
