#!/usr/bin/env node

/**
 * Executable entry point for the Glia Functions CLI
 * 
 * This is the main file that gets executed when the CLI is run
 * Supports both interactive mode and direct command execution
 * 
 * NOTE: This implementation now uses Commander.js exclusively for CLI parsing.
 * Previous Yargs-based implementation is deprecated as of March 2025.
 */

import { Command } from 'commander';
import { runCLI, createBearerToken } from '../src/cli/index.js';
import { routeCommand } from '../src/cli/command-router.js';
import { getApiConfig, getCliVersion, hasValidBearerToken, getAuthConfig, updateEnvFile, updateGlobalConfig } from '../src/lib/config.js';
import GliaApiClient from '../src/lib/api.js';
import chalk from 'chalk';
import * as fs from 'fs';
import path from 'path';
import os from 'os';

// Global config paths
const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.glia-cli');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.env');

// Remove banner for cleaner CLI output

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
    try {
      // Get API configuration directly
      const apiConfig = await getApiConfig();
      
      // Create API client
      const api = new GliaApiClient(apiConfig);
      
      // Show we're working
      console.log(chalk.blue('ℹ️  Loading functions...'));
      
      // List functions
      const result = await api.listFunctions();
      
      // Format and display the results
      if (!result.functions || result.functions.length === 0) {
        console.log(chalk.blue('ℹ️  Info:'), 'No functions found.');
      } else {
        if (options.detailed) {
          console.log(chalk.blue('ℹ️  Info:'), 'Functions (detailed):');
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.blue('ℹ️  Info:'), `Found ${result.functions.length} functions:`);
          
          // Create table format manually
          console.log(chalk.bold('\nID                                     Name                  Description'));
          console.log(chalk.dim('─────────────────────────────────────── ───────────────────── ───────────────────'));
          
          result.functions.forEach(fn => {
            // Pad and truncate fields for table formatting
            const id = fn.id.padEnd(38).substring(0, 38);
            const name = (fn.name || '').padEnd(20).substring(0, 20);
            const description = (fn.description || '(No description)').substring(0, 40);
            
            console.log(`${id} ${name} ${description}`);
          });
          console.log(''); // Extra line at the end
        }
      }
      
      // Delay the exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100); // Small delay to ensure output is flushed
      
    } catch (error) {
      console.error(chalk.red(`Error listing functions: ${error.message}`));
      
      // Delay the exit to ensure error is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Create function command
program
  .command('create-function')
  .description('Create a new function')
  .requiredOption('--name <name>', 'Function name')
  .option('--description <description>', 'Function description', '')
  .action(async (options) => {
    try {
      // Get API configuration directly
      const apiConfig = await getApiConfig();
      
      // Create API client
      const api = new GliaApiClient(apiConfig);
      
      console.log(chalk.blue('ℹ️  Info:'), `Creating function "${options.name}"...`);
      
      // Create the function
      const result = await api.createFunction(options.name, options.description);
      
      // Display the results
      console.log(chalk.green('✅ Success:'), 'Function created successfully!');
      console.log('\nFunction details:');
      console.log(JSON.stringify(result, null, 2));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(chalk.red(`Error creating function: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Deploy function version command
program
  .command('deploy')
  .description('Deploy a function version')
  .requiredOption('--function-id <functionId>', 'Function ID')
  .requiredOption('--version-id <versionId>', 'Version ID')
  .action(async (options) => {
    try {
      // Get API configuration directly
      const apiConfig = await getApiConfig();
      
      // Create API client
      const api = new GliaApiClient(apiConfig);
      
      console.log(chalk.blue('ℹ️  Info:'), 'Deploying function version...');
      
      // Deploy the version
      const result = await api.deployVersion(options.functionId, options.versionId);
      
      // Display success
      console.log(chalk.green('✅ Success:'), 'Function version deployed successfully!');
      console.log('\nDeployment details:');
      console.log(JSON.stringify(result, null, 2));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(chalk.red(`Error deploying function version: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Invoke function command
program
  .command('invoke-function')
  .description('Invoke a function')
  .requiredOption('--function-id <functionId>', 'Function ID')
  .option('--payload <payload>', 'JSON payload', '{}')
  .action(async (options) => {
    try {
      // Parse the payload if it's a string
      let payload = options.payload;
      try {
        if (typeof payload === 'string') {
          payload = JSON.parse(payload);
        }
      } catch (error) {
        console.error(chalk.red('Invalid JSON payload:', error.message));
        process.exit(1);
      }
      
      // Get API configuration directly
      const apiConfig = await getApiConfig();
      
      // Create API client
      const api = new GliaApiClient(apiConfig);
      
      // Get the function details to obtain invocation URI
      console.log(chalk.blue('ℹ️  Info:'), 'Getting function details...');
      const functionDetails = await api.getFunction(options.functionId);
      
      if (!functionDetails || !functionDetails.invocation_uri) {
        console.error(chalk.red('Error: Function has no invocation URI. Is it deployed?'));
        process.exit(1);
      }
      
      console.log(chalk.blue('ℹ️  Info:'), 'Invoking function...');
      
      // Invoke the function
      const result = await api.invokeFunction(functionDetails.invocation_uri, payload);
      
      // Display the result
      console.log(chalk.green('✅ Success:'), 'Function invoked successfully!');
      console.log('\nFunction response:');
      
      // Pretty print if it's JSON, otherwise print as-is
      if (typeof result === 'object') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result);
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(chalk.red(`Error invoking function: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Fetch logs command
program
  .command('fetch-logs')
  .description('Fetch function logs')
  .requiredOption('--function-id <functionId>', 'Function ID')
  .action(async (options) => {
    try {
      // Get API configuration directly
      const apiConfig = await getApiConfig();
      
      // Create API client
      const api = new GliaApiClient(apiConfig);
      
      console.log(chalk.blue('ℹ️  Info:'), 'Fetching logs...');
      
      // Fetch logs
      const result = await api.getFunctionLogs(options.functionId);
      
      // Display results
      if (!result || !result.logs || result.logs.length === 0) {
        console.log(chalk.blue('ℹ️  Info:'), 'No logs found.');
      } else {
        console.log(chalk.blue('ℹ️  Info:'), `Found ${result.logs.length} log entries:`);
        console.log(JSON.stringify(result, null, 2));
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(chalk.red(`Error fetching logs: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
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
    try {
      // Parse the environment variables
      let env = options.env;
      try {
        if (typeof env === 'string') {
          env = JSON.parse(env);
        }
      } catch (error) {
        console.error(chalk.red('Invalid JSON for environment variables:', error.message));
        process.exit(1);
      }
      
      // Get API configuration directly
      const apiConfig = await getApiConfig();
      const api = new GliaApiClient(apiConfig);
      
      // Read and bundle the function code
      console.log(chalk.blue('ℹ️  Info:'), `Bundling code from ${options.path}...`);
      const { execSync } = require('child_process');
      
      try {
        execSync(`npm run build ${options.path}`, { stdio: 'inherit' });
      } catch (error) {
        console.error(chalk.red('Error bundling code:'), error.message);
        process.exit(1);
      }
      
      // Read the bundled code
      const fs = require('fs');
      let code;
      try {
        code = fs.readFileSync('./function-out.js', 'utf8');
      } catch (error) {
        console.error(chalk.red('Error reading bundled code:'), error.message);
        process.exit(1);
      }
      
      // Create version options
      const versionOptions = {
        environmentVariables: env,
        compatibilityDate: options.compatibilityDate === 'latest' ? null : options.compatibilityDate
      };
      
      // Create the version
      console.log(chalk.blue('ℹ️  Info:'), 'Creating function version...');
      const createResult = await api.createVersion(options.functionId, code, versionOptions);
      
      console.log(chalk.green('✅ Success:'), 'Function version created!');
      console.log('\nVersion creation task details:');
      console.log(JSON.stringify(createResult, null, 2));
      
      // If deploy flag is set, deploy the version
      if (options.deploy) {
        // Wait for version to be ready by polling the task
        console.log(chalk.blue('ℹ️  Info:'), 'Waiting for version to be ready...');
        
        let versionId = null;
        let taskCompleted = false;
        
        for (let i = 0; i < 10; i++) { // Try for up to 10 attempts (20 seconds)
          const taskResult = await api.getVersionCreationTask(options.functionId, createResult.id);
          
          if (taskResult.status === 'completed') {
            versionId = taskResult.result.id;
            taskCompleted = true;
            break;
          } else if (taskResult.status === 'failed') {
            console.error(chalk.red('Version creation failed:'), taskResult.result?.error || 'Unknown error');
            
            // Delay exit to ensure error message is flushed
            setTimeout(() => {
              process.exit(1);
            }, 100);
            return;
          }
          
          // Wait 2 seconds before checking again
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        if (!taskCompleted) {
          console.error(chalk.yellow('⚠️  Warning:'), 'Version creation is taking longer than expected.');
          console.log('You can deploy it manually once it completes using:');
          console.log(`glia-functions deploy --function-id ${options.functionId} --version-id <version-id>`);
          
          // Delay exit to ensure message is flushed
          setTimeout(() => {
            process.exit(0);
          }, 100);
          return;
        }
        
        // Deploy the version
        console.log(chalk.blue('ℹ️  Info:'), 'Deploying new version...');
        const deployResult = await api.deployVersion(options.functionId, versionId);
        
        console.log(chalk.green('✅ Success:'), 'Version deployed successfully!');
        console.log('\nDeployment details:');
        console.log(JSON.stringify(deployResult, null, 2));
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(chalk.red(`Error creating/deploying version: ${error.message}`));
      
      // Delay exit to ensure error message is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Handle interactive mode when no arguments provided
if (process.argv.length <= 2) {
  runCLI()
    .then(() => {
      // Ensure process exits after CLI completes
      if (!process.exitCode) process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red(`Unexpected error: ${error.message}`));
      console.error('Please report this issue on GitHub or contact support.');
      process.exit(1);
    });
} else {
  // Check for valid bearer token before parsing command line arguments
  hasValidBearerToken().then(async hasToken => {
    if (!hasToken) {
      console.log(chalk.yellow('⚠️ No valid bearer token found or token has expired.'));
      
      // Check if we have auth config to auto-refresh the token
      try {
        const authConfig = await getAuthConfig();
        if (authConfig.keyId && authConfig.keySecret) {
          console.log(chalk.blue('ℹ️  Automatically refreshing authentication token...'));
          
          // Generate new token
          const tokenInfo = await createBearerToken(
            authConfig.keyId, 
            authConfig.keySecret, 
            authConfig.apiUrl || 'https://api.glia.com'
          );
          
          // Save to the same location as the authConfig (assuming the source is either global or local)
          const useGlobal = fs.existsSync(GLOBAL_CONFIG_FILE) && 
            fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf8').includes(`GLIA_KEY_ID=${authConfig.keyId}`);
          
          const updateFn = useGlobal ? updateGlobalConfig : updateEnvFile;
          
          await updateFn({
            'GLIA_BEARER_TOKEN': tokenInfo.token,
            'GLIA_TOKEN_EXPIRES_AT': tokenInfo.expiresAt
          });
          
          // Update process.env for current session
          process.env.GLIA_BEARER_TOKEN = tokenInfo.token;
          process.env.GLIA_TOKEN_EXPIRES_AT = tokenInfo.expiresAt.toString();
          
          console.log(chalk.green('✅ Authentication token refreshed successfully.'));
        } else {
          console.log(chalk.yellow('Some commands may fail without proper authentication.'));
          console.log(chalk.yellow('Consider running the CLI in interactive mode first to set up your environment.'));
          console.log('');
        }
      } catch (error) {
        console.log(chalk.yellow('Some commands may fail without proper authentication.'));
        console.log(chalk.yellow('Consider running the CLI in interactive mode first to set up your environment.'));
        console.log('');
      }
    }
    // Parse command line arguments
    program.parse();
    
    // Since we're dealing with commander.js, there's a chance that no action is called
    // if the user provides incorrect or no command. In that case, commander will display help
    // and we don't want to exit prematurely.
    // 
    // Do not exit - let commander handle the flow
  }).catch(error => {
    console.error(chalk.red(`Error checking token validity: ${error.message}`));
    // Continue anyway with command parsing
    program.parse();
    
    // Do not exit - let commander handle the flow
  });
}
