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
import { routeCommand } from '../src/cli/command-router.js';
// Import project commands directly at top level to ensure it's loaded first
import projectCommands from './glia-functions-project-commands.js';
import {
  getApiConfig,
  getCliVersion,
  refreshBearerTokenIfNeeded,
  listProfiles,
  createProfile,
  switchProfile,
  deleteProfile
} from '../src/lib/config.js';
import GliaApiClient from '../src/lib/api.js';
import colorizer from '../src/utils/colorizer.js';
import * as fs from 'fs';
import path from 'path';

// Create program instance
const program = new Command();

// Export program for use in other command modules
export { program };

// Make program available globally to avoid circular import issues
global.__glia_cli_program = program;

/**
 * Build an API client for a command that talks to the API directly.
 *
 * Authentication is deliberately lazy: nothing is minted or refreshed until a
 * command actually needs it, so --help, --version, init, dev and
 * list-templates work offline and with no credentials configured.
 *
 * @returns {Promise<GliaApiClient>} An authenticated API client
 */
async function createApiClient() {
  await refreshBearerTokenIfNeeded();
  return new GliaApiClient(await getApiConfig());
}

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
  console.error(colorizer.red(`Error loading project commands: ${error.message}`));
}

// List functions command
program
  .command('list-functions')
  .description('List all available functions')
  .option('-d, --detailed', 'Show detailed output', false)
  .action(async (options) => {
    try {
      // Create API client (auth is acquired lazily)
      const api = await createApiClient();
      
      // Show we're working
      console.log(colorizer.blue('ℹ️  Loading functions...'));
      
      // List functions
      const result = await api.listFunctions();
      
      // Format and display the results
      if (!result.functions || result.functions.length === 0) {
        console.log(colorizer.blue('ℹ️  Info:'), 'No functions found.');
      } else {
        if (options.detailed) {
          console.log(colorizer.blue('ℹ️  Info:'), 'Functions (detailed):');
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(colorizer.blue('ℹ️  Info:'), `Found ${result.functions.length} functions:`);
          
          // Create table format manually
          console.log(colorizer.bold('\nID                                     Name                  Description'));
          console.log(colorizer.dim('─────────────────────────────────────── ───────────────────── ───────────────────'));
          
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
      console.error(colorizer.red(`Error listing functions: ${error.message}`));
      
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
        
        console.log(colorizer.blue('ℹ️  Available function templates:'));
        
        if (templates.length === 0) {
          console.log('No templates available');
        } else {
          templates.forEach(template => {
            console.log(`- ${colorizer.bold(template.name)}: ${template.description}`);
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
        
        console.log(colorizer.blue('ℹ️  Info:'), `Creating function file from template "${options.template}"...`);
        
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
            
            console.log(colorizer.blue('ℹ️  Recommended environment variables for this template:'));
            for (const [key, value] of Object.entries(envVars)) {
              console.log(`- ${key}: ${value}`);
            }
          }
          
          console.log(colorizer.green('✅ Success:'), `Function file created at: ${outputPath}`);
        } catch (error) {
          console.error(colorizer.red(`Error creating function file: ${error.message}`));
          if (!options.skipApi) {
            console.log(colorizer.yellow('⚠️  Warning:'), 'Continuing with API function creation...');
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
          console.error(colorizer.red('Error: No template specified with --skip-api. Nothing to do.'));
          // Delay exit to ensure output is flushed
          setTimeout(() => {
            process.exit(1);
          }, 100);
        }
        return;
      }
      
      // Create function via API
      // Create API client (auth is acquired lazily)
      const api = await createApiClient();
      
      console.log(colorizer.blue('ℹ️  Info:'), `Creating function "${options.name}"...`);
      
      // Create the function
      const result = await api.createFunction(options.name, options.description);
      
      // Display the results
      console.log(colorizer.green('✅ Success:'), 'Function created successfully!');
      console.log('\nFunction details:');
      console.log(JSON.stringify(result, null, 2));
      
      // Mention template if used
      if (templateResult) {
        console.log(colorizer.blue('ℹ️  Info:'), `Function file created at: ${templateResult.filePath}`);
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(colorizer.red(`Error creating function: ${error.message}`));
      
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
        console.error(colorizer.red('Error:'), 'Please provide at least one field to update (--name or --description)');
        process.exit(1);
      }
      
      // Show progress
      console.log(colorizer.blue('ℹ️  Info:'), `Updating function "${options.id}"...`);
      
      // Let routeCommand handle errors consistently
      const result = await routeCommand('update-function', options);
      
      // Display success message
      console.log(colorizer.green('✅ Success:'), `Function "${result.id}" updated successfully`);
      
      // Show the updated values
      if (options.name !== undefined) {
        console.log(colorizer.blue('ℹ️  Name:'), result.name);
      }
      
      if (options.description !== undefined) {
        console.log(colorizer.blue('ℹ️  Description:'), result.description);
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

// Environment variables management command
program
  .command('update-env-vars')
  .description('List or update the environment variables of a function')
  .requiredOption('--id <id>', 'Function ID')
  .option('--list', 'List current environment variables')
  .option('--env <envVars>', 'Environment variables to set, as a JSON object string')
  .option('--env-file <path>', 'Path to a JSON file containing environment variables')
  .option('--no-deploy', 'Create a new version but do not deploy it')
  .option('--output <path>', 'Write environment variables to a file (with --list)')
  .option('--json', 'Output raw JSON')
  .option('--profile <profile>', 'Profile to use for this operation')
  .addHelpText('after', `
Examples:
  $ glia update-env-vars --id abc123 --list
  $ glia update-env-vars --id abc123 --env '{"API_KEY":"secret"}'
  $ glia update-env-vars --id abc123 --env-file ./env.json --no-deploy

Setting a variable to null deletes it. Updating environment variables always
creates a new function version; it is deployed unless --no-deploy is passed.`)
  .action(async (options) => {
    try {
      // Load variables from a file if one was given
      if (options.envFile) {
        if (!fs.existsSync(options.envFile)) {
          console.error(colorizer.red('Error:'), `File not found: ${options.envFile}`);
          process.exit(1);
        }
        options.env = fs.readFileSync(options.envFile, 'utf8');
        console.log(colorizer.blue('ℹ️  Info:'), `Loaded environment variables from ${options.envFile}`);
      }

      if (!options.list && !options.env) {
        console.error(colorizer.red('Error:'), 'Specify --list, --env or --env-file');
        process.exit(1);
      }

      // Parse the JSON payload for updates
      let env;
      if (options.env) {
        try {
          env = typeof options.env === 'string' ? JSON.parse(options.env) : options.env;
        } catch (error) {
          console.error(colorizer.red('Error:'), `Invalid JSON for environment variables: ${error.message}`);
          process.exit(1);
        }
      }

      const result = await routeCommand('update-env-vars', {
        id: options.id,
        list: options.list,
        env,
        deploy: options.deploy
      }, false);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (options.list) {
        const envVars = result.environmentVariables || {};
        console.log(colorizer.green('✅ Success:'), `${result.functionName} (${result.functionId})`);
        console.log(colorizer.blue('ℹ️  Version:'), result.versionId);
        const keys = Object.keys(envVars);
        if (keys.length === 0) {
          console.log('No environment variables defined.');
        } else {
          const pad = Math.max(...keys.map(k => k.length));
          keys.forEach(k => console.log(`  ${colorizer.bold(k.padEnd(pad))}: ${envVars[k]}`));
        }
      } else {
        console.log(colorizer.green('✅ Success:'), result.deployed
          ? 'Environment variables updated and deployed.'
          : 'Environment variables updated; new version not deployed.');
        console.log(colorizer.blue('ℹ️  New version:'), result.newVersionId);
      }

      // Write the listed variables out to a file if requested
      if (options.list && options.output) {
        const envVars = result.environmentVariables || {};
        const dir = path.dirname(options.output);
        if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(options.output, JSON.stringify(envVars, null, 2));
        console.log(colorizer.green('✅ Success:'), `Written to ${options.output}`);
      }

      setTimeout(() => process.exit(0), 100);
    } catch (error) {
      const { handleError } = await import('../src/cli/error-handler.js');
      handleError(error);
      setTimeout(() => process.exit(1), 100);
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
      // Create API client (auth is acquired lazily)
      const api = await createApiClient();
      
      console.log(colorizer.blue('ℹ️  Info:'), 'Deploying function version...');
      
      // Deploy the version
      const result = await api.deployVersion(options.functionId, options.versionId);
      
      // Display success
      console.log(colorizer.green('✅ Success:'), 'Function version deployed successfully!');
      console.log('\nDeployment details:');
      console.log(JSON.stringify(result, null, 2));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(colorizer.red(`Error deploying function version: ${error.message}`));
      
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
        console.error(colorizer.red('Invalid JSON payload:', error.message));
        process.exit(1);
      }
      
      // Create API client (auth is acquired lazily)
      const api = await createApiClient();
      
      // Get the function details to obtain invocation URI
      console.log(colorizer.blue('ℹ️  Info:'), 'Getting function details...');
      const functionDetails = await api.getFunction(options.functionId);
      
      if (!functionDetails || !functionDetails.invocation_uri) {
        console.error(colorizer.red('Error: Function has no invocation URI. Is it deployed?'));
        process.exit(1);
      }
      
      console.log(colorizer.blue('ℹ️  Info:'), 'Invoking function...');
      
      // Invoke the function
      const result = await api.invokeFunction(functionDetails.invocation_uri, payload);
      
      // Display the result
      console.log(colorizer.green('✅ Success:'), 'Function invoked successfully!');
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
      console.error(colorizer.red(`Error invoking function: ${error.message}`));
      
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
      // Create API client (auth is acquired lazily)
      const api = await createApiClient();
      
      console.log(colorizer.blue('ℹ️  Info:'), 'Fetching logs...');
      
      // Fetch logs
      const result = await api.getFunctionLogs(options.functionId);
      
      // Display results
      if (!result || !result.logs || result.logs.length === 0) {
        console.log(colorizer.blue('ℹ️  Info:'), 'No logs found.');
      } else {
        console.log(colorizer.blue('ℹ️  Info:'), `Found ${result.logs.length} log entries:`);
        console.log(JSON.stringify(result, null, 2));
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(colorizer.red(`Error fetching logs: ${error.message}`));
      
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
      
      console.log(colorizer.blue('ℹ️  Available profiles:'));
      
      if (profiles.length === 0 && currentProfile === 'default') {
        console.log('No custom profiles found. Using default profile.');
      } else {
        // Ensure default is in the list
        const allProfiles = [...new Set(['default', ...profiles])];
        
        allProfiles.forEach(profile => {
          if (profile === currentProfile) {
            console.log(`  ${colorizer.green('*')} ${profile} ${colorizer.dim('(current)')}`);
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
      console.error(colorizer.red(`Error listing profiles: ${error.message}`));
      
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
      console.log(colorizer.green('✅ Success:'), `Profile '${options.name}' created successfully`);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(colorizer.red(`Error creating profile: ${error.message}`));
      
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
      console.log(colorizer.green('✅ Success:'), `Switched to profile '${options.name}'`);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(colorizer.red(`Error switching profile: ${error.message}`));
      
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
          console.log(colorizer.blue('ℹ️  Info:'), 'Profile deletion cancelled.');
          process.exit(0);
          return;
        }
      }
      
      await deleteProfile(options.name);
      console.log(colorizer.green('✅ Success:'), `Profile '${options.name}' deleted successfully`);
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(colorizer.red(`Error deleting profile: ${error.message}`));
      
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
        console.error(colorizer.red('Invalid JSON for environment variables:', error.message));
        process.exit(1);
      }
      
      // Create API client (auth is acquired lazily)
      const api = await createApiClient();
      
      // Read and bundle the function code
      console.log(colorizer.blue('ℹ️  Info:'), `Bundling code from ${options.path}...`);
      const { execFileSync } = await import('node:child_process');

      try {
        execFileSync('npm', ['run', 'build', options.path], { stdio: 'inherit' });
      } catch (error) {
        console.error(colorizer.red('Error bundling code:'), error.message);
        process.exit(1);
      }
      
      // Read the bundled code
      let code;
      try {
        code = fs.readFileSync('./function-out.js', 'utf8');
      } catch (error) {
        console.error(colorizer.red('Error reading bundled code:'), error.message);
        process.exit(1);
      }
      
      // Create version options
      const versionOptions = {
        environmentVariables: env,
        compatibilityDate: options.compatibilityDate === 'latest' ? null : options.compatibilityDate
      };
      
      // Create the version
      console.log(colorizer.blue('ℹ️  Info:'), 'Creating function version...');
      const createResult = await api.createVersion(options.functionId, code, versionOptions);
      
      console.log(colorizer.green('✅ Success:'), 'Function version created!');
      console.log('\nVersion creation task details:');
      console.log(JSON.stringify(createResult, null, 2));
      
      // If deploy flag is set, deploy the version
      if (options.deploy) {
        // Wait for version to be ready by polling the task
        console.log(colorizer.blue('ℹ️  Info:'), 'Waiting for version to be ready...');
        
        let versionId = null;
        let taskCompleted = false;
        
        for (let i = 0; i < 10; i++) { // Try for up to 10 attempts (20 seconds)
          const taskResult = await api.getVersionCreationTask(options.functionId, createResult.id);
          
          if (taskResult.status === 'completed') {
            versionId = taskResult.result.id;
            taskCompleted = true;
            break;
          } else if (taskResult.status === 'failed') {
            console.error(colorizer.red('Version creation failed:'), taskResult.result?.error || 'Unknown error');
            
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
          console.error(colorizer.yellow('⚠️  Warning:'), 'Version creation is taking longer than expected.');
          console.log('You can deploy it manually once it completes using:');
          console.log(`glia-functions deploy --function-id ${options.functionId} --version-id <version-id>`);
          
          // Delay exit to ensure message is flushed
          setTimeout(() => {
            process.exit(0);
          }, 100);
          return;
        }
        
        // Deploy the version
        console.log(colorizer.blue('ℹ️  Info:'), 'Deploying new version...');
        const deployResult = await api.deployVersion(options.functionId, versionId);
        
        console.log(colorizer.green('✅ Success:'), 'Version deployed successfully!');
        console.log('\nDeployment details:');
        console.log(JSON.stringify(deployResult, null, 2));
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
      
    } catch (error) {
      console.error(colorizer.red(`Error creating/deploying version: ${error.message}`));
      
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
        console.log(colorizer.blue('ℹ️  Available function templates:'));
        
        if (templates.length === 0) {
          console.log('No templates available');
        } else {
          templates.forEach(template => {
            console.log(`- ${colorizer.bold(template.name)}: ${template.description}`);
          });
          console.log('\nUse create-function command with --template option to create a function from a template');
        }
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(colorizer.red(`Error listing templates: ${error.message}`));
      
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
        console.log(colorizer.blue('ℹ️  Available applet templates:'));
        
        if (templates.length === 0) {
          console.log('No applet templates available');
        } else {
          templates.forEach(template => {
            console.log(`- ${colorizer.bold(template.displayName)}: ${template.description}`);
          });
        }
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error(colorizer.red(`Error listing applet templates: ${error.message}`));
      
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
      console.error(colorizer.red(`Error creating applet: ${error.message}`));
      
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
      console.error(colorizer.red(`Error deploying applet: ${error.message}`));
      
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
      console.error(colorizer.red(`Error listing applets: ${error.message}`));
      
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
      console.error(colorizer.red(`Error updating applet: ${error.message}`));
      
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
      console.error(colorizer.red(`Error listing KV pairs: ${error.message}`));
      
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
      console.error(colorizer.red(`Error getting KV value: ${error.message}`));
      
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
      console.error(colorizer.red(`Error setting KV value: ${error.message}`));
      
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
      console.error(colorizer.red(`Error deleting KV value: ${error.message}`));
      
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
      console.error(colorizer.red(`Error in test-and-set operation: ${error.message}`));
      
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
          console.error(colorizer.red(`Invalid environment variables JSON: ${error.message}`));
          process.exit(1);
        }
      }
      
      // Import and run dev command
      console.log(colorizer.blue('ℹ️  Starting local development server...'));
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
      console.error(colorizer.red(`Development server error: ${error.message}`));
      
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
  .action(async (options) => {
    try {
      // Handle list templates option
      if (options.listTemplates) {
        try {
          const { listProjectTemplates } = await import('../src/utils/project-template-manager.js');
          const templates = await listProjectTemplates();
          
          console.log(colorizer.blue('ℹ️  Available project templates:'));
          
          if (templates.length === 0) {
            console.log('No project templates available');
          } else {
            templates.forEach(template => {
              console.log(`- ${colorizer.bold(template.displayName)}: ${template.description}`);
            });
          }
          
          // Delay exit to ensure output is flushed
          setTimeout(() => {
            process.exit(0);
          }, 100);
          return;
        } catch (error) {
          console.error(colorizer.red(`Error listing project templates: ${error.message}`));
          
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
      console.error(colorizer.red(`Error initializing project: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

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
        console.log(colorizer.green('✅ Export handler setup completed successfully'));
      } else {
        console.log(colorizer.yellow('⚠️ Export handler setup cancelled or failed'));
      }
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(result ? 0 : 1);
      }, 100);
    } catch (error) {
      console.error(colorizer.red(`❌ Error setting up export handler: ${error.message}`));
      
      // Delay exit to ensure output is flushed
      setTimeout(() => {
        process.exit(1);
      }, 100);
    }
  });

// MCP server command
program
  .command('mcp')
  .description('Start the MCP (Model Context Protocol) server for AI assistant integration')
  .action(async () => {
    try {
      // Import the start MCP server command
      const { startMcpServer } = await import('../src/commands/startMcpServer.js');

      // Start the server (this will run indefinitely)
      await startMcpServer();
    } catch (error) {
      console.error(colorizer.red(`Error starting MCP server: ${error.message}`));
      process.exit(1);
    }
  });

// Alias commands for MCP server
program
  .command('start-mcp')
  .description('Alias for "mcp" command')
  .action(async () => {
    const { startMcpServer } = await import('../src/commands/startMcpServer.js');
    await startMcpServer();
  });

program
  .command('mcp-server')
  .description('Alias for "mcp" command')
  .action(async () => {
    const { startMcpServer } = await import('../src/commands/startMcpServer.js');
    await startMcpServer();
  });

// Add --profile to every command that does not already declare it.
program.commands.forEach(command => {
  // The `profiles` command group manages profiles itself.
  if (command.name() === 'profiles') return;
  if (command.options.some(option => option.long === '--profile')) return;
  command.option('--profile <profile>', 'Profile to use for this operation');
});

// Apply --profile before the selected command's action runs. A preAction hook is
// used rather than wrapping each action: Commander does not expose the
// registered handler, so the previous `command.actionFunction` wrapper never
// fired and profiles only worked via the raw argv scan below.
program.hook('preAction', (thisCommand, actionCommand) => {
  const profile = actionCommand.opts().profile;
  if (profile) {
    process.env.GLIA_PROFILE = profile;
  }
});

// When invoked with no arguments, show help rather than starting an
// interactive menu. The interactive layer has been retired; all commands are
// now flag-driven and every one works with --json for scripted use.
if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
} else {
  // Resolve --profile from raw argv before anything reads configuration: the
  // active profile determines which config file is loaded.
  const profileIndex = process.argv.findIndex(arg => arg === '--profile');
  if (profileIndex > 0 && profileIndex < process.argv.length - 1) {
    process.env.GLIA_PROFILE = process.argv[profileIndex + 1];
  }

  // Authentication is lazy. Commands that need the API mint or refresh a token
  // on demand (routeCommand -> refreshBearerTokenIfNeeded, or createApiClient
  // here), and GliaApiClient refreshes and retries on a 401. Nothing is
  // requested up front, so --help, --version, init, dev and list-templates work
  // offline with no credentials configured.
  program.parseAsync(process.argv).catch(error => {
    console.error(colorizer.red(`Error: ${error.message}`));
    process.exit(1);
  });
}
