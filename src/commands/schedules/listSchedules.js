/**
 * Command to list scheduled triggers
 */
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import BaseCommand from '../../cli/base-command.js';
import { parseCronExpression, getNextExecutionTime, formatTimeRemaining } from '../../utils/cron-helper.js';

/**
 * List all scheduled triggers
 *
 * @param {Object} [options] - Command options
 * @returns {Promise<Object>} List of triggers
 */
export async function listSchedules(options = {}) {
  try {
    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);

    const result = await api.listScheduledTriggers();
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('list-schedules', 'List all scheduled triggers')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        command.info('Fetching scheduled triggers...');

        const result = await listSchedules();

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (!result.items || result.items.length === 0) {
          command.info('No scheduled triggers found');
          return;
        }

        command.success(`Found ${result.items.length} scheduled trigger(s)`);
        console.log('');

        result.items.forEach((trigger, index) => {
          console.log(`${index + 1}. ${trigger.name} (${trigger.enabled ? 'Enabled' : 'Disabled'})`);
          console.log(`   ID: ${trigger.id}`);
          console.log(`   Function: ${trigger.trigger_id}`);
          console.log(`   Pattern: ${trigger.schedule_pattern}`);
          console.log(`   Description: ${parseCronExpression(trigger.schedule_pattern)}`);

          const nextRun = getNextExecutionTime(trigger.schedule_pattern);
          if (nextRun && trigger.enabled) {
            console.log(`   Next run: ${nextRun.toISOString()} (in ${formatTimeRemaining(nextRun)})`);
          } else if (!trigger.enabled) {
            console.log(`   Next run: Disabled`);
          }

          if (trigger.description) {
            console.log(`   Notes: ${trigger.description}`);
          }
          console.log('');
        });
      } catch (error) {
        throw error;
      }
    });

  command.parse(process.argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default listSchedules;
