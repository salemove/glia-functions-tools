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

// Program instance will be created below

import { Command } from 'commander';
import { runCLI, createBearerToken } from '../src/cli/index.js';
import { routeCommand } from '../src/cli/command-router.js';
// Import project commands directly at top level to ensure it's loaded first
import projectCommands from './glia-functions-project-commands.js';
import { 
  getApiConfig, 
  getCliVersion, 
  hasValidBearerToken, 
  getAuthConfig, 
  updateEnvFile, 
  updateGlobalConfig,
  listProfiles,
  createProfile,
  updateProfile,
  switchProfile,
  deleteProfile 
} from '../src/lib/config.js';
import GliaApiClient from '../src/lib/api.js';
import chalk from 'chalk';
import * as fs from 'fs';
import path from 'path';
import os from 'os';
import { confirm } from '@inquirer/prompts';

// Global config paths
const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.glia-cli');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.env');

// Remove banner for cleaner CLI output

// Create program instance
const program = new Command();

// Export program for use in other command modules
export { program };

// Make program available globally to avoid circular import issues
global.__glia_cli_program = program;

// Configure basic program information
program
  .name('glia-functions')
  .description('CLI for managing Glia Functions - a serverless JavaScript runtime')
  .version(`${getCliVersion()}`, '-v, --version')
  .showSuggestionAfterError(true);
  
// Register project commands immediately before any other commands
try {
  projectCommands(program);
} catch (error) {
  console.error(chalk.red(`Error loading project commands: ${error.message}`));
}

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
  .option('--template <template>', 'Template to use for function')
  .option('--output <path>', 'Output path for function file')
  .option('--list-templates', 'List available templates')
  .option('--skip-api', 'Skip creating function via API (local only)')
  .action(async (options) => {
    try {
      // List templates if requested
      if (options.listTemplates) {
        const { listTemplates } = await import('../src/utils/template-manager.js');
        const templates = await listTemplates();
        
        console.log(chalk.blue('ℹ️  Available function templates:'));
        
        if (templates.length === 0) {
          console.log('No templates available');
        } else {
          templates.forEach(template => {
            console.log(`- ${chalk.bold(template.name)}: ${template.description}`);
          });
        }
        
        // Delay exit to ensure output is flushed
        setTimeout(() => {
          process.exit(0);
        }, 100);
        return;
      }
      
      // Handle template creation if specified
      let templateResult = null;
      if (options.template) {
        const { createFromTemplate, getTemplateEnvVars } = await import('../src/utils/template-manager.js');
        
        // Determine output path
        const outputPath = options.output || path.resolve(process.cwd(), `${options.name.replace(/\s+/g, '-')}.js`);
        
        console.log(chalk.blue('ℹ️  Info:'), `Creating function file from template "${options.template}"...`);
        
        try {
          // Create function file from template
          await createFromTemplate(options.template, outputPath, {
            functionName: options.name
          });
          
          templateResult = {
            filePath: outputPath
          };
          
          // Get recommended environment variables for this template
          const envVars = await getTemplateEnvVars(options.template);
          if (Object.keys(envVars).length > 0) {
            templateResult.envVars = envVars;
            
            console.log(chalk.blue('ℹ️  Recommended environment variables for this template:'));
            for (const [key, value] of Object.entries(envVars)) {
              console.log(`- ${key}: ${value}`);
            }
          }
          
          console.log(chalk.green('✅ Success:'), `Function file created at: ${outputPath}`);
        } catch (error) {
          console.error(chalk.red(`Error creating function file: ${error.message}`));
          if (!options.skipApi) {
            console.log(chalk.yellow('⚠️  Warning:'), 'Continuing with API function creation...');
          } else {
            // Delay exit to ensure output is flushed
            setTimeout(() => {
              process.exit(1);
            }, 100);
            return;
          }
        }
      }
      
      // Skip API function creation if requested
      if (options.skipApi) {
        if (templateResult) {
          // Delay exit to ensure output is flushed
          setTimeout(() => {
            process.exit(0);
          }, 100);
        } else {
          console.error(chalk.red('Error: No template specified with --skip-api. Nothing to do.'));
          // Delay exit to ensure output is flushed
          setTimeout(() => {
            process.exit(1);
          }, 100);
        }
        return;
      }
      
      // Create function via API
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
      
      // Mention template if used
      if (templateResult) {
        console.log(chalk.blue('ℹ️  Info:'), `Function file created at: ${templateResult.filePath}`);
      }
      
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

// Update function command
program
  .command('update-function')
  .description('Update a function\'s name and/or description')
  .requiredOption('--id <id>', 'Function ID')
  .option('--name <name>', 'New function name')
  .option('--description <description>', 'New function description')
  .option('--profile <profile>', 'Profile to use for this operation')
  .action(async (options) => {
    try {
      // Validate that at least one update field is provided
      if (options.name === undefined && options.description === undefined) {
        console.error(chalk.red('Error:'), 'Please provide at least one field to update (--name or --description)');
        process.exit(1);
      }
      
      // Show progress
      console.log(chalk.blue('ℹ️  Info:'), `Updating function "${options.id}"...`);
      
      // Let routeCommand handle errors consistently
      const result = await routeCommand('update-function', options);
      
      // Display success message
      console.log(chalk.green('✅ Success:'), `Function "${result.id}" updated successfully`);
      
      // Show the updated values
      if (options.name !== undefined) {
        console.log(chalk.blue('ℹ️  Name:'), result.name);
      }
      
      if (options.description !== undefined) {
        console.log(chalk.blue('ℹ️  Description:'), result.description);
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      // Use the standardized error handler from error-handler.js
      const { handleError } = await import('../src/cli/error-handler.js');
      handleError(error);
      
      // Delay exit to ensure error is flushed
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

// Profile management commands
const profilesCommand = program
  .command('profiles')
  .description('Manage configuration profiles for different environments');

// List profiles
profilesCommand
  .command('list')
  .description('List all available profiles')
  .action(async () => {
    try {
      const profiles = listProfiles();
      const currentProfile = process.env.GLIA_PROFILE || 'default';
      
      console.log(chalk.blue('ℹ️  Available profiles:'));
      
      if (profiles.length === 0 && currentProfile === 'default') {
        console.log('No custom profiles found. Using default profile.');
      } else {
        // Ensure default is in the list
        const allProfiles = [...new Set(['default', ...profiles])];
        
        allProfiles.forEach(profile => {
          if (profile === currentProfile) {
            console.log(`  ${chalk.green('*')} ${profile} ${chalk.dim('(current)')}`);
          } else {
            console.log(`    ${profile}`);
          }
        });
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(chalk.red(`Error listing profiles: ${error.message}`));
      
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Create profile
profilesCommand
  .command('create')
  .description('Create a new profile')
  .requiredOption('--name <name>', 'Profile name')
  .action(async (options) => {
    try {
      await createProfile(options.name);
      console.log(chalk.green('✅ Success:'), `Profile '${options.name}' created successfully`);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(chalk.red(`Error creating profile: ${error.message}`));
      
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Switch profile
profilesCommand
  .command('switch')
  .description('Switch to a different profile')
  .requiredOption('--name <name>', 'Profile name to switch to')
  .action(async (options) => {
    try {
      await switchProfile(options.name);
      console.log(chalk.green('✅ Success:'), `Switched to profile '${options.name}'`);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(chalk.red(`Error switching profile: ${error.message}`));
      
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Delete profile
profilesCommand
  .command('delete')
  .description('Delete a profile')
  .requiredOption('--name <name>', 'Profile name to delete')
  .option('--force', 'Force deletion without confirmation')
  .action(async (options) => {
    try {
      if (!options.force) {
        // Use inquirer for confirmation
        const shouldDelete = await confirm({
          message: `Are you sure you want to delete profile '${options.name}'? This action cannot be undone.`
        });
        
        if (!shouldDelete) {
          console.log(chalk.blue('ℹ️  Info:'), 'Profile deletion cancelled.');
          process.exit(0);
          return;
        }
      }
      
      await deleteProfile(options.name);
      console.log(chalk.green('✅ Success:'), `Profile '${options.name}' deleted successfully`);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(chalk.red(`Error deleting profile: ${error.message}`));
      
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
  .option('--profile <profile>', 'Profile to use for this operation')
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

// List templates command
program
  .command('list-templates')
  .description('List available function templates')
  .option('--format <format>', 'Output format (text, json)', 'text')
  .action(async (options) => {
    try {
      const { listTemplates } = await import('../src/utils/template-manager.js');
      const templates = await listTemplates();
      
      // Display results based on format
      if (options.format === 'json') {
        console.log(JSON.stringify(templates, null, 2));
      } else {
        console.log(chalk.blue('ℹ️  Available function templates:'));
        
        if (templates.length === 0) {
          console.log('No templates available');
        } else {
          templates.forEach(template => {
            console.log(`- ${chalk.bold(template.name)}: ${template.description}`);
          });
          console.log('\nUse create-function command with --template option to create a function from a template');
        }
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error listing templates: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Applet management commands
program
  .command('list-applet-templates')
  .description('List available applet templates')
  .option('--format <format>', 'Output format (text, json)', 'text')
  .action(async (options) => {
    try {
      const { listAppletTemplates } = await import('../src/utils/applet-template-manager.js');
      const templates = await listAppletTemplates();
      
      // Display results based on format
      if (options.format === 'json') {
        console.log(JSON.stringify(templates, null, 2));
      } else {
        console.log(chalk.blue('ℹ️  Available applet templates:'));
        
        if (templates.length === 0) {
          console.log('No applet templates available');
        } else {
          templates.forEach(template => {
            console.log(`- ${chalk.bold(template.displayName)}: ${template.description}`);
          });
        }
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error listing applet templates: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

program
  .command('create-applet')
  .description('Create a new applet from a template')
  .option('--name <name>', 'Applet name')
  .option('--description <description>', 'Applet description')
  .option('--template <template>', 'Template to use for applet')
  .option('--output <path>', 'Output directory path')
  .option('--owner-site-id <siteId>', 'Owner site ID (required for deployment)')
  .option('--deploy', 'Deploy the applet after creation', false)
  .option('--scope <scope>', 'Applet scope (engagement or global)', 'engagement')
  .option('--author <author>', 'Author name')
  .option('--list-templates', 'List available templates')
  .action(async (options) => {
    try {
      // Route the command
      const result = await routeCommand('create-applet', options);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error creating applet: ${error.message}`));
      
      // Delay exit to ensure error message is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

program
  .command('deploy-applet')
  .description('Deploy an applet to a site')
  .requiredOption('--path <path>', 'Path to applet HTML file')
  .requiredOption('--owner-site-id <siteId>', 'Owner site ID')
  .requiredOption('--name <name>', 'Applet name')
  .option('--description <description>', 'Applet description')
  .option('--scope <scope>', 'Applet scope (engagement or global)', 'engagement')
  .action(async (options) => {
    try {
      // Route the command
      const result = await routeCommand('deploy-applet', options);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error deploying applet: ${error.message}`));
      
      // Delay exit to ensure error message is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

program
  .command('list-applets')
  .description('List available applets')
  .option('--site-id <siteId>', 'Filter by site ID')
  .option('--scope <scope>', 'Filter by scope (engagement, global)')
  .option('-d, --detailed', 'Show detailed output', false)
  .action(async (options) => {
    try {
      // Route the command
      const result = await routeCommand('list-applets', options);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error listing applets: ${error.message}`));
      
      // Delay exit to ensure error message is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

program
  .command('update-applet')
  .description('Update an existing applet')
  .requiredOption('--id <id>', 'Applet ID')
  .option('--path <path>', 'Path to new applet HTML file')
  .option('--name <name>', 'New applet name')
  .option('--description <description>', 'New applet description')
  .option('--scope <scope>', 'New applet scope (engagement or global)')
  .action(async (options) => {
    try {
      // Route the command
      const result = await routeCommand('update-applet', options);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error updating applet: ${error.message}`));
      
      // Delay exit to ensure error message is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// KV Store commands
program
  .command('kv:list')
  .description('List all key-value pairs in a namespace')
  .requiredOption('--namespace <namespace>', 'KV store namespace')
  .option('--all', 'Fetch all pages of results', false)
  .option('--limit <limit>', 'Maximum number of items to fetch per page')
  .option('--json', 'Output in JSON format', false)
  .action(async (options) => {
    try {
      // Route to command handler
      const result = await routeCommand('kv:list', options);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error listing KV pairs: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

program
  .command('kv:get')
  .description('Get a value from the KV store')
  .requiredOption('--namespace <namespace>', 'KV store namespace')
  .requiredOption('--key <key>', 'Key to get')
  .option('--json', 'Output in JSON format', false)
  .action(async (options) => {
    try {
      // Route to command handler
      const result = await routeCommand('kv:get', options);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error getting KV value: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

program
  .command('kv:set')
  .description('Set a value in the KV store')
  .requiredOption('--namespace <namespace>', 'KV store namespace')
  .requiredOption('--key <key>', 'Key to set')
  .requiredOption('--value <value>', 'Value to set')
  .option('--json', 'Output in JSON format', false)
  .action(async (options) => {
    try {
      // Route to command handler
      const result = await routeCommand('kv:set', options);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error setting KV value: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

program
  .command('kv:delete')
  .description('Delete a value from the KV store')
  .requiredOption('--namespace <namespace>', 'KV store namespace')
  .requiredOption('--key <key>', 'Key to delete')
  .option('--json', 'Output in JSON format', false)
  .action(async (options) => {
    try {
      // Route to command handler
      const result = await routeCommand('kv:delete', options);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error deleting KV value: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

program
  .command('kv:test-and-set')
  .description('Conditionally update a value in the KV store')
  .requiredOption('--namespace <namespace>', 'KV store namespace')
  .requiredOption('--key <key>', 'Key to update')
  .requiredOption('--old-value <oldValue>', 'Expected current value')
  .requiredOption('--new-value <newValue>', 'New value to set')
  .option('--json', 'Output in JSON format', false)
  .action(async (options) => {
    try {
      // Convert command line options to API parameters
      const apiOptions = {
        ...options,
        oldValue: options.oldValue,
        newValue: options.newValue
      };
      
      // Route to command handler
      const result = await routeCommand('kv:test-and-set', apiOptions);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error in test-and-set operation: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Dev server command
program
  .command('dev')
  .description('Run function locally in development mode')
  .requiredOption('--path <path>', 'Path to function file')
  .option('--port <port>', 'Port to run server on', '8787')
  .option('--watch', 'Watch for file changes and rebuild', false)
  .option('--env <json>', 'Environment variables as JSON string', '{}')
  .option('--profile <name>', 'Profile to use for environment variables')
  .action(async (options) => {
    try {
      // Parse environment variables
      let env = {};
      if (options.env && options.env !== '{}') {
        try {
          env = JSON.parse(options.env);
        } catch (error) {
          console.error(chalk.red(`Invalid environment variables JSON: ${error.message}`));
          process.exit(1);
        }
      }
      
      // Import and run dev command
      console.log(chalk.blue('ℹ️  Starting local development server...'));
      const { dev } = await import('../src/commands/dev.js');
      
      const result = await dev({
        path: options.path,
        port: parseInt(options.port, 10) || 8787,
        watch: options.watch,
        env,
        profile: options.profile
      });
      
      // Keep process running until manually stopped
      process.stdin.resume();
      
    } catch (error) {
      console.error(chalk.red(`Development server error: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Init project command
program
  .command('init')
  .description('Initialize a new function project from template')
  .option('--template <name>', 'Project template to use')
  .option('--output <path>', 'Output directory path')
  .option('--variables <vars>', 'Template variables (key1=value1,key2=value2)')
  .option('--list-templates', 'List available project templates')
  .option('--force', 'Force create even if directory exists')
  
// Setup export handler command
program
  .command('setup-export-handler')
  .description('Set up an export event handler')
  .option('--event-type <type>', 'Export event type (engagement-start, engagement-end, engagement-transfer, presence-update)')
  .option('--output-dir <path>', 'Directory where the project will be created')
  .option('--project-name <name>', 'Name for the export handler project')
  .option('--interactive [boolean]', 'Run in interactive mode', true)
  .action(async (options) => {
    try {
      // Import both the handler and the BaseCommand
      const [setupExportHandlerModule, { BaseCommand }] = await Promise.all([
        import('../src/commands/exports/setupExportHandler.js'),
        import('../src/cli/base-command.js')
      ]);
      
      // Create a BaseCommand instance for output formatting
      const command = new BaseCommand('setup-export-handler', 'Set up an export event handler');
      
      // Convert string 'false' to boolean false for the interactive flag
      const processedOptions = {
        ...options,
        interactive: options.interactive === 'false' ? false : Boolean(options.interactive),
        projectName: options.projectName || `${options.eventType || 'export'}-handler`
      };
      
      // Call the handler with processed options and command
      const result = await setupExportHandlerModule.default(processedOptions, command);
      
      if (result) {
        console.log(chalk.green('✅ Export handler setup completed successfully'));
      } else {
        console.log(chalk.yellow('⚠️ Export handler setup cancelled or failed'));
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(result ? 0 : 1);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`❌ Error setting up export handler: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Continue with init command action
program.commands.find(cmd => cmd.name() === 'init').action(async (options) => {
    try {
      // Handle list templates option
      if (options.listTemplates) {
        try {
          const { listProjectTemplates } = await import('../src/utils/project-template-manager.js');
          const templates = await listProjectTemplates();
          
          console.log(chalk.blue('ℹ️  Available project templates:'));
          
          if (templates.length === 0) {
            console.log('No project templates available');
          } else {
            templates.forEach(template => {
              console.log(`- ${chalk.bold(template.displayName)}: ${template.description}`);
            });
          }
          
          // Delay exit to ensure output is flushed
          setTimeout(() => {
            process.exit(0);
          }, 100);
          return;
        } catch (error) {
          console.error(chalk.red(`Error listing project templates: ${error.message}`));
          
          // Delay exit to ensure output is flushed
          setTimeout(() => {
            process.exit(1);
          }, 100);
          return;
        }
      }
      
      // Parse variables if provided
      let parsedVars = {};
      if (options.variables) {
        parsedVars = options.variables.split(',').reduce((vars, item) => {
          const [key, value] = item.split('=');
          if (key && value) {
            vars[key.trim()] = value.trim();
          }
          return vars;
        }, {});
      }
      
      // Import and run init command
      const { initCommand } = await import('../src/commands/init.js');
      await initCommand({
        template: options.template,
        output: options.output,
        variables: parsedVars,
        force: options.force
      });
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(chalk.red(`Error initializing project: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// Add --profile option to all commands
program.commands.forEach(command => {
  // Skip the profiles command as it already handles profiles
  if (command.name() !== 'profiles') {
    command.option('--profile <profile>', 'Profile to use for this operation');
    
    // Wrap the action to set the profile before executing
    const originalAction = command.actionFunction;
    if (originalAction) {
      command.action((options, ...args) => {
        if (options.profile) {
          // Set the profile for this command execution
          process.env.GLIA_PROFILE = options.profile;
        }
        
        // Call the original action
        return originalAction(options, ...args);
      });
    }
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
  // Check for profile flag first
  const profileIndex = process.argv.findIndex(arg => arg === '--profile');
  if (profileIndex > 0 && profileIndex < process.argv.length - 1) {
    // Set the profile for this command execution
    process.env.GLIA_PROFILE = process.argv[profileIndex + 1];
  }
  
  // Ensure configuration is loaded properly
  const loadAndCheckConfig = async () => {
    try {
      // Load full configuration first to ensure site ID is properly loaded
      const { loadConfig } = await import('../src/lib/config.js');
      const config = await loadConfig();
      
      // Check if site ID is missing but we have auth config
      if (!config.siteId) {
        console.log(chalk.yellow('⚠️ No site ID found in configuration.'));
        console.log(chalk.yellow('Some commands may fail without a site ID.'));
        console.log(chalk.yellow('Consider running the CLI in interactive mode to set a site ID.'));
        console.log('');
      }
      
      // Check for valid bearer token
      const hasToken = await hasValidBearerToken();
      // Skip token check for profile commands
      const isProfileCommand = process.argv.includes('profiles');
      
      if (!hasToken && !isProfileCommand) {
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
              authConfig.apiUrl || 'https://api.glia.com',
              config.siteId // Pass site ID to validate access
            );
            
            // Check if we're using a specific profile
            const profileName = process.env.GLIA_PROFILE || 'default';
            
            // Check if token has suggested site ID and we need to update
            if (!config.siteId && tokenInfo.suggestedSiteId) {
              console.log(chalk.blue(`ℹ️  Found available site ID: ${tokenInfo.suggestedSiteId}`));
              console.log(chalk.blue('ℹ️  Setting as default site ID for this session.'));
              
              // Update site ID in environment
              process.env.GLIA_SITE_ID = tokenInfo.suggestedSiteId;
              
              // Include site ID in updates
              const updates = {
                'GLIA_BEARER_TOKEN': tokenInfo.token,
                'GLIA_TOKEN_EXPIRES_AT': tokenInfo.expiresAt,
                'GLIA_SITE_ID': tokenInfo.suggestedSiteId
              };
              
              // Save to the appropriate location
              if (profileName !== 'default') {
                await updateProfile(profileName, updates);
              } else {
                const useGlobal = fs.existsSync(GLOBAL_CONFIG_FILE) && 
                  fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf8').includes(`GLIA_KEY_ID=${authConfig.keyId}`);
                
                const updateFn = useGlobal ? updateGlobalConfig : updateEnvFile;
                await updateFn(updates);
              }
              
              console.log(chalk.green(`✅ Site ID ${tokenInfo.suggestedSiteId} set and saved to configuration.`));
            } else {
              // Standard token update without site ID change
              const updates = {
                'GLIA_BEARER_TOKEN': tokenInfo.token,
                'GLIA_TOKEN_EXPIRES_AT': tokenInfo.expiresAt
              };
              
              // Save to the appropriate location
              if (profileName !== 'default') {
                await updateProfile(profileName, updates);
              } else {
                const useGlobal = fs.existsSync(GLOBAL_CONFIG_FILE) && 
                  fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf8').includes(`GLIA_KEY_ID=${authConfig.keyId}`);
                
                const updateFn = useGlobal ? updateGlobalConfig : updateEnvFile;
                await updateFn(updates);
              }
            }
            
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
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Warning: Error loading configuration: ${error.message}`));
      console.log(chalk.yellow('Some commands may fail. Consider running the CLI in interactive mode first.'));
    }
  };
  
  // We need to import project commands module at top level
  // This is handled separately
  
  // Load and check configuration before parsing commands
  loadAndCheckConfig().then(() => {
    // Parse command line arguments - after all commands are registered
    program.parse();
    
    // Since we're dealing with commander.js, there's a chance that no action is called
    // if the user provides incorrect or no command. In that case, commander will display help
    // and we don't want to exit prematurely.
    // 
    // Do not exit - let commander handle the flow
  }).catch(error => {
    console.error(chalk.red(`Error loading configuration: ${error.message}`));
    // Continue anyway with command parsing
    program.parse();
    
    // Do not exit - let commander handle the flow
  });
}

