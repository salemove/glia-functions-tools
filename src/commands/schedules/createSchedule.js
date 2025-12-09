/**
 * Command to create a scheduled trigger
 *
 * Creates a scheduled trigger for a Glia Function using cron expressions
 */
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import BaseCommand from '../../cli/base-command.js';
import {
  validateCronExpression,
  parseCronExpression,
  getPresetOptions,
  getNextExecutionTime,
  formatTimeRemaining,
  buildCronExpression
} from '../../utils/cron-helper.js';
import { input, select, confirm } from '@inquirer/prompts';

/**
 * Create a scheduled trigger
 *
 * @param {Object} options - Command options
 * @param {string} options.name - Trigger name
 * @param {string} [options.description] - Trigger description
 * @param {string} options.functionId - Function ID to trigger
 * @param {string} options.schedulePattern - Cron expression
 * @param {boolean} [options.interactive] - Use interactive mode
 * @returns {Promise<Object>} Created trigger details
 */
export async function createSchedule(options) {
  try {
    let schedulePattern = options.schedulePattern;
    let name = options.name;
    let description = options.description;
    let functionId = options.functionId;

    // Interactive mode
    if (options.interactive) {
      // Get function ID if not provided
      if (!functionId) {
        const apiConfig = await getApiConfig();
        const api = new GliaApiClient(apiConfig);

        // List functions
        const functions = await api.listFunctions();

        if (!functions.functions || functions.functions.length === 0) {
          throw new Error('No functions found. Please create a function first.');
        }

        // Let user select function
        const functionChoices = functions.functions.map(f => ({
          name: `${f.name} (${f.id})`,
          value: f.id
        }));

        functionId = await select({
          message: 'Select function to schedule:',
          choices: functionChoices
        });
      }

      // Get trigger name
      if (!name) {
        name = await input({
          message: 'Enter trigger name:',
          validate: (input) => input ? true : 'Name is required'
        });
      }

      // Get trigger description
      if (!description) {
        description = await input({
          message: 'Enter trigger description (optional):',
          default: ''
        });
      }

      // Build cron expression
      if (!schedulePattern) {
        schedulePattern = await buildCronInteractive();
      }
    }

    // Validate inputs
    if (!name) {
      throw new Error('Trigger name is required');
    }
    if (!functionId) {
      throw new Error('Function ID is required');
    }
    if (!schedulePattern) {
      throw new Error('Schedule pattern is required');
    }

    // Validate cron expression
    const validation = validateCronExpression(schedulePattern);
    if (!validation.valid) {
      throw new Error(`Invalid cron expression: ${validation.error}`);
    }

    // Get API configuration
    const apiConfig = await getApiConfig();

    // Create API client
    const api = new GliaApiClient(apiConfig);

    // Create the scheduled trigger
    const result = await api.createScheduledTrigger({
      name,
      description,
      functionId,
      schedulePattern
    });

    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Interactive cron expression builder
 */
async function buildCronInteractive() {
  // Ask if user wants to use a preset
  const usePreset = await confirm({
    message: 'Would you like to use a common schedule preset?',
    default: true
  });

  if (usePreset) {
    const presetOptions = getPresetOptions();
    const presetChoices = presetOptions.map(p => ({
      name: p.name,
      value: p.value,
      description: p.value
    }));

    presetChoices.push({
      name: 'Custom expression...',
      value: 'custom',
      description: 'Build a custom cron expression'
    });

    const selected = await select({
      message: 'Select a schedule:',
      choices: presetChoices
    });

    if (selected !== 'custom') {
      // Show preview
      const description = parseCronExpression(selected);
      const nextRun = getNextExecutionTime(selected);
      const timeRemaining = nextRun ? formatTimeRemaining(nextRun) : 'Unknown';

      console.log(`\nSchedule: ${description}`);
      console.log(`Next run: ${nextRun ? nextRun.toISOString() : 'Unknown'} (in ${timeRemaining})\n`);

      const confirmPreset = await confirm({
        message: 'Use this schedule?',
        default: true
      });

      if (confirmPreset) {
        return selected;
      }
    }
  }

  // Custom expression builder
  console.log('\nBuild a custom cron expression');
  console.log('Format: Minutes Hours Day-of-month Month Day-of-week [Year]');
  console.log('Note: Use ? for either day-of-month or day-of-week (not both)\n');

  const minutes = await input({
    message: 'Minutes (0-59, *, */N for intervals):',
    default: '0',
    validate: (input) => {
      const result = validateCronExpression(`${input} * * * ? *`);
      return result.valid ? true : result.error;
    }
  });

  const hours = await input({
    message: 'Hours (0-23, *, */N for intervals):',
    default: '*',
    validate: (input) => {
      const result = validateCronExpression(`0 ${input} * * ? *`);
      return result.valid ? true : result.error;
    }
  });

  const useDay = await select({
    message: 'Schedule by:',
    choices: [
      { name: 'Day of month', value: 'dom' },
      { name: 'Day of week', value: 'dow' }
    ]
  });

  let dayOfMonth = '?';
  let dayOfWeek = '?';

  if (useDay === 'dom') {
    dayOfMonth = await input({
      message: 'Day of month (1-31, *, L for last day):',
      default: '*'
    });
  } else {
    dayOfWeek = await input({
      message: 'Day of week (1=Sun, 2=Mon...7=Sat, *):',
      default: '*',
      validate: (input) => {
        const result = validateCronExpression(`0 0 ? * ${input} *`);
        return result.valid ? true : result.error;
      }
    });
  }

  const month = await input({
    message: 'Month (1-12, *):',
    default: '*',
    validate: (input) => {
      const result = validateCronExpression(`0 0 1 ${input} ? *`);
      return result.valid ? true : result.error;
    }
  });

  const cronExpression = buildCronExpression({
    minutes,
    hours,
    dayOfMonth,
    month,
    dayOfWeek
  });

  // Show preview
  const description = parseCronExpression(cronExpression);
  const nextRun = getNextExecutionTime(cronExpression);
  const timeRemaining = nextRun ? formatTimeRemaining(nextRun) : 'Unknown';

  console.log(`\nCron expression: ${cronExpression}`);
  console.log(`Description: ${description}`);
  console.log(`Next run: ${nextRun ? nextRun.toISOString() : 'Unknown'} (in ${timeRemaining})\n`);

  const confirmCustom = await confirm({
    message: 'Use this schedule?',
    default: true
  });

  if (!confirmCustom) {
    // Restart
    return await buildCronInteractive();
  }

  return cronExpression;
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('create-schedule', 'Create a scheduled trigger for a function')
    .option('--name <name>', 'Trigger name')
    .option('--description <description>', 'Trigger description')
    .option('--function-id <id>', 'Function ID to trigger')
    .option('--schedule <pattern>', 'Cron expression (e.g., "0 9 * * ? *")')
    .option('--interactive', 'Use interactive mode to build schedule', true)
    .action(async (options) => {
      try {
        // Show operation status
        if (!options.interactive) {
          command.info('Creating scheduled trigger...');
        }

        // Create the scheduled trigger
        const result = await createSchedule({
          name: options.name,
          description: options.description,
          functionId: options.functionId,
          schedulePattern: options.schedule,
          interactive: options.interactive || (!options.name || !options.functionId || !options.schedule)
        });

        // Display success message
        command.success(`Scheduled trigger "${result.name}" created successfully`);
        command.info(`Trigger ID: ${result.id}`);
        command.info(`Schedule: ${parseCronExpression(result.schedule_pattern)}`);
        command.info(`Status: ${result.enabled ? 'Enabled' : 'Disabled'}`);

        const nextRun = getNextExecutionTime(result.schedule_pattern);
        if (nextRun) {
          command.info(`Next run: ${nextRun.toISOString()} (in ${formatTimeRemaining(nextRun)})`);
        }
      } catch (error) {
        throw error;
      }
    });

  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default createSchedule;
