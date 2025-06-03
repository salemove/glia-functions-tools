#!/usr/bin/env node

/**
 * Executable entry point for the Glia Functions CLI using Commander.js
 * 
 * Implements a standardized command line interface using Commander.js
 * instead of the mixed Yargs/Commander implementation
 */

import { Command } from 'commander';
import { runCLI } from '../src/cli/index.js';
import { routeCommand } from '../src/cli/command-router.js';
import { getApiConfig, getCliVersion } from '../src/lib/config.js';
import GliaApiClient from '../src/lib/api.js';
import chalk from 'chalk';

// Create program instance
const program = new Command();

// Configure basic program information
program
  .name('glia-functions')
  .description('CLI for managing Glia Functions - a serverless JavaScript runtime')
  .version(`${getCliVersion()}`, '-v, --version')
  .showSuggestionAfterError(true);

// List functions command
program
  .command('list-functions')
  .description('List all available functions')
  .option('-d, --detailed', 'Show detailed output', false)
  .action(async (options) => {
    await routeCommand('list-functions', {
      detailed: options.detailed
    });
  });

// Create function command
program
  .command('create-function')
  .description('Create a new function')
  .requiredOption('--name <name>', 'Function name')
  .option('--description <description>', 'Function description', '')
  .action(async (options) => {
    await routeCommand('create-function', {
      name: options.name,
      description: options.description
    });
  });

// Deploy function version command
program
  .command('deploy')
  .description('Deploy a function version')
  .requiredOption('--function-id <functionId>', 'Function ID')
  .requiredOption('--version-id <versionId>', 'Version ID')
  .action(async (options) => {
    await routeCommand('deploy', {
      functionId: options.functionId,
      versionId: options.versionId
    });
  });

// Invoke function command
program
  .command('invoke-function')
  .description('Invoke a function')
  .requiredOption('--function-id <functionId>', 'Function ID')
  .option('--payload <payload>', 'JSON payload', '{}')
  .action(async (options) => {
    // Parse the payload if it's a string
    let payload = options.payload;
    try {
      if (typeof payload === 'string') {
        payload = JSON.parse(payload);
      }
    } catch (error) {
      console.error('Invalid JSON payload:', error.message);
      process.exit(1);
    }
    
    // Get the function details to obtain invocation URI
    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);
    const functionDetails = await api.getFunction(options.functionId);
    
    await routeCommand('invoke-function', {
      invocationUri: functionDetails.invocation_uri,
      payload
    });
  });

// Fetch logs command
program
  .command('fetch-logs')
  .description('Fetch function logs')
  .requiredOption('--function-id <functionId>', 'Function ID')
  .action(async (options) => {
    await routeCommand('fetch-logs', {
      functionId: options.functionId
    });
  });

// Create and deploy version command (with bundle support)
program
  .command('create-version')
  .description('Create and optionally deploy a new function version')
  .requiredOption('--function-id <functionId>', 'Function ID')
  .requiredOption('--path <path>', 'Path to function code file')
  .option('--env <env>', 'Environment variables as JSON string', '{}')
  .option('--compatibility-date <date>', 'Compatibility date (YYYY-MM-DD format)', 'latest')
  .option('--deploy', 'Deploy this version after creation', false)
  .action(async (options) => {
    // Parse the environment variables
    let env = options.env;
    try {
      if (typeof env === 'string') {
        env = JSON.parse(env);
      }
    } catch (error) {
      console.error('Invalid JSON for environment variables:', error.message);
      process.exit(1);
    }
    
    await routeCommand('create-and-deploy-version', {
      functionId: options.functionId,
      path: options.path,
      env: env,
      compatibilityDate: options.compatibilityDate === 'latest' ? null : options.compatibilityDate,
      deploy: options.deploy
    });
  });

// Environment variables management command
program
  .command('update-env-vars')
  .description('Manage environment variables for a function')
  .requiredOption('--id <id>', 'Function ID')
  .option('--list', 'List current environment variables')
  .option('--env <envVars>', 'Environment variables to update (JSON string)')
  .option('--env-file <path>', 'Path to JSON file containing environment variables')
  .option('--no-deploy', 'Create new version but don\'t deploy it')
  .option('--interactive', 'Interactive mode for adding/updating/deleting variables')
  .option('--output <path>', 'Export environment variables to file (with --list)')
  .action(async (options) => {
    try {
      // Parse env file if specified
      if (options.envFile) {
        try {
          const fs = await import('fs');
          if (!fs.existsSync(options.envFile)) {
            console.error(`File not found: ${options.envFile}`);
            process.exit(1);
          }
          
          options.env = fs.readFileSync(options.envFile, 'utf8');
          console.log(chalk.blue(`Loaded environment variables from ${options.envFile}`));
        } catch (error) {
          console.error(`Failed to read environment variables file: ${error.message}`);
          process.exit(1);
        }
      }
      
      // Forward command to the router
      await routeCommand('update-env-vars', {
        id: options.id,
        list: options.list,
        env: options.env,
        deploy: options.deploy,
        interactive: options.interactive,
        output: options.output
      });
    } catch (error) {
      console.error(chalk.red(`Error managing environment variables: ${error.message}`));
      process.exit(1);
    }
  });

// Handle interactive mode when no arguments provided
if (process.argv.length <= 2) {
  runCLI().catch(error => {
    console.error(chalk.red(`Unexpected error: ${error.message}`));
    console.error('Please report this issue on GitHub or contact support.');
    process.exit(1);
  });
} else {
  // Parse command line arguments
  program.parse();
}
