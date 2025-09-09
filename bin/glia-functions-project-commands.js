/**
 * Project management commands
 * 
 * This module defines the deploy-project command and related functionality.
 * It's imported directly in the main CLI entry point to ensure proper command registration.
 */

import colorizer from '../src/utils/colorizer.js';
import { routeCommand } from '../src/cli/command-router.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Adds project deployment commands to the CLI program
 * @param {import('commander').Command} program - Commander program instance
 * @returns {void}
 */
export default function addProjectCommands(program) {
  // Deploy project command
  program
  .command('deploy-project')
  .description('Deploy multiple functions and applets together as a coordinated project')
  .option('--manifest <path>', 'Path to project manifest file', 'glia-project.json')
  .option('--dry-run', 'Only validate, don\'t deploy', false)
  .option('--skip-kv-data', 'Skip populating KV store data', false)
  .option('--skip-functions', 'Skip function deployment', false)
  .option('--skip-applets', 'Skip applet deployment', false)
  .option('--no-rollback', 'Disable rollback on failure', false)
  .option('--json', 'Output results as JSON', false)
  .action(async (options) => {
    try {
      // Validate manifest file exists
      const manifestPath = options.manifest || 'glia-project.json';
      try {
        await fs.access(manifestPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.error(colorizer.red(`Project manifest file not found: ${manifestPath}`));
          console.error(colorizer.yellow(`Create a ${colorizer.bold('glia-project.json')} file in your project directory.`));
          process.exit(1);
        }
        throw error;
      }

      // Prepare options for command
      const commandOptions = {
        manifest: manifestPath,
        dryRun: options.dryRun,
        skipKvData: options.skipKvData,
        skipFunctions: options.skipFunctions,
        skipApplets: options.skipApplets,
        rollbackOnFailure: !options.noRollback,
        json: options.json
      };

      // Route to command handler
      const result = await routeCommand('deploy-project', commandOptions);
      
      // Format output
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!result.success) {
        console.error(colorizer.red(`Project deployment failed: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(colorizer.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });
}

