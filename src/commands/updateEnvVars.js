/**
 * Command to manage environment variables for a Glia Function
 *
 * This command allows viewing and updating environment variables for a function
 * without deploying new code. It creates a new version with the updated
 * environment variables and deploys it automatically.
 * 
 * Features:
 * - List existing environment variables
 * - Add, update, or delete environment variables individually
 * - Bulk update environment variables via JSON
 * - Import/export environment variables from/to files
 * - Interactive mode for easier management
 */
import { getApiConfig } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';
import BaseCommand from '../cli/base-command.js';
import { input, select, confirm, editor, checkbox } from '@inquirer/prompts';
import colorizer from '../utils/colorizer.js';
import fs from 'fs';
import path from 'path';
import { parseAndValidateJson } from '../lib/validation.js';

/**
 * Formats environment variables for display
 * 
 * @param {Object} envVars - Environment variables
 * @returns {string} Formatted string for display
 */
function formatEnvVars(envVars, versionId = null) {
  if (!envVars || Object.keys(envVars).length === 0) {
    return `No environment variables defined${versionId ? ` for version ${colorizer.bold(versionId)}` : ''}.`;
  }
  
  const longestKeyLength = Math.max(...Object.keys(envVars).map(key => key.length));
  const result = [];
  
  // If version ID is provided, include it in the header
  if (versionId) {
    result.push(`Environment variables for version ${colorizer.bold(versionId)}:`);
  }
  
  for (const [key, value] of Object.entries(envVars)) {
    const paddedKey = key.padEnd(longestKeyLength);
    const displayValue = value === '********' ? colorizer.dim('(secured value)') : value;
    result.push(`  ${colorizer.bold(paddedKey)}: ${displayValue}`);
  }
  
  return result.join('\n');
}

/**
 * List environment variables for a function
 * 
 * @param {Object} options - Command options
 * @param {string} options.id - Function ID
 * @returns {Promise<Object>} Environment variables (keys only)
 */
export async function listEnvVars(options) {
  try {
    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);
    
    // Get the function first to ensure it exists and get its current version
    const functionData = await api.getFunction(options.id);
    
    if (!functionData.current_version || !functionData.current_version.id) {
      throw new Error(`Function ${options.id} has no current version deployed.`);
    }
    
    // Get environment variables from current version
    const envVars = await api.getVersionEnvVars(options.id, functionData.current_version.id);
    
    return {
      functionId: options.id,
      functionName: functionData.name,
      versionId: functionData.current_version.id,
      environmentVariables: envVars
    };
  } catch (error) {
    // Don't handle errors here - propagate to caller for consistent handling
    throw error;
  }
}

/**
 * Update environment variables for a function
 * 
 * @param {Object} options - Command options
 * @param {string} options.id - Function ID
 * @param {Object} options.env - Environment variables to update
 * @param {boolean} [options.deploy=true] - Whether to deploy immediately
 * @returns {Promise<Object>} Result of the update operation
 */
export async function updateEnvVars(options) {
  try {
    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);
    
    // Get the function first to ensure it exists and get its current version
    const functionData = await api.getFunction(options.id);
    
    if (!functionData.current_version || !functionData.current_version.id) {
      throw new Error(`Function ${options.id} has no current version deployed.`);
    }
    
    // Update environment variables
    const result = await api.updateEnvVars(
      options.id, 
      functionData.current_version.id, 
      options.env,
      options.deploy !== false // Default to true
    );
    
    return {
      functionId: options.id,
      functionName: functionData.name,
      oldVersionId: functionData.current_version.id,
      newVersionId: result.entity?.id,
      deployed: result.deployed,
      message: result.message
    };
  } catch (error) {
    // Don't handle errors here - propagate to caller for consistent handling
    throw error;
  }
}

/**
 * Interactive environment variable management with modern UI
 * 
 * @param {Object} options - Command options
 * @param {string} options.id - Function ID
 * @param {boolean} [options.deploy=true] - Whether to deploy immediately
 * @returns {Promise<Object>} Result of the operation
 */
export async function interactiveEnvVars(options) {
  try {
    const apiConfig = await getApiConfig();
    const api = new GliaApiClient(apiConfig);
    
    // Get the function first to ensure it exists and get its current version
    const functionData = await api.getFunction(options.id);
    
    if (!functionData.current_version || !functionData.current_version.id) {
      throw new Error(`Function ${options.id} has no current version deployed.`);
    }
    
    // Get current environment variables
    const currentEnvVars = await api.getVersionEnvVars(options.id, functionData.current_version.id);
    
    console.log(colorizer.blue(`\nManaging environment variables for function: ${colorizer.bold(functionData.name)} (${options.id})`));
    console.log(colorizer.blue(`Current version: ${colorizer.bold(functionData.current_version.id)}`));
    console.log(colorizer.blue(`Created at: ${new Date(functionData.current_version.created_at).toLocaleString()}`));
    console.log(colorizer.yellow(`\nNote: Changes to environment variables will create a new function version.`));
    console.log(colorizer.blue(`\nCurrent environment variables:`));
    console.log(formatEnvVars(currentEnvVars, functionData.current_version.id));
    
    // Ask which operation to perform
    const operation = await select({
      message: 'Select operation:',
      choices: [
        {
          name: 'Add or update variables',
          value: 'add',
          description: 'Add new or update existing environment variables'
        },
        {
          name: 'Delete variables',
          value: 'delete',
          description: 'Remove environment variables'
        },
        {
          name: 'Bulk edit using JSON editor',
          value: 'bulk',
          description: 'Edit all environment variables at once in JSON format'
        },
        {
          name: 'Import from file',
          value: 'import',
          description: 'Import environment variables from a JSON file'
        },
        {
          name: 'Export to file',
          value: 'export',
          description: 'Export current environment variables to a JSON file'
        },
        {
          name: 'Exit',
          value: 'exit',
          description: 'Return to previous menu'
        }
      ]
    });
    
    if (operation === 'exit') {
      return { message: 'Operation cancelled.' };
    }
    
    let updates = {};
    
    if (operation === 'add') {
      // Add/update mode
      let addingVars = true;
      while (addingVars) {
        // Get existing variable names as suggestions
        const existingVars = Object.keys(currentEnvVars);
        
        // Ask for variable name with autocomplete for existing vars
        const name = await input({
          message: 'Variable name (empty to finish):',
          validate: (input) => {
            if (input.includes(' ')) return 'Environment variable names cannot contain spaces';
            return true;
          }
        });
        
        if (!name) {
          addingVars = false;
          continue;
        }
        
        // Check if variable already exists
        const isExisting = existingVars.includes(name);
        
        // If existing, show current value
        if (isExisting) {
          console.log(colorizer.yellow(`Current value: ${currentEnvVars[name]}`));
        }
        
        // Ask for variable value
        const value = await input({
          message: `Enter value for ${name}:`,
          default: isExisting ? currentEnvVars[name] : ''
        });
        
        updates[name] = value;
        console.log(colorizer.green(`✓ Variable ${colorizer.bold(name)} ${isExisting ? 'updated' : 'added'}`));
      }
    } else if (operation === 'delete') {
      // Delete mode - first check if there are any vars to delete
      const envVarKeys = Object.keys(currentEnvVars);
      
      if (envVarKeys.length === 0) {
        console.log(colorizer.yellow('No environment variables to delete.'));
        return { message: 'No environment variables to delete.' };
      }
      
      // Allow user to select multiple vars to delete
      const keysToDelete = await checkbox({
        message: 'Select variables to delete:',
        choices: envVarKeys.map(key => ({
          name: key,
          value: key
        }))
      });
      
      if (keysToDelete.length === 0) {
        return { message: 'No variables selected for deletion.' };
      }
      
      // Mark selected keys for deletion
      keysToDelete.forEach(key => {
        updates[key] = null; // Setting to null deletes it
      });
      
      console.log(colorizer.yellow(`Selected ${keysToDelete.length} variable(s) for deletion.`));
    } else if (operation === 'bulk') {
      // Open JSON editor with current vars
      let envVarsJson = JSON.stringify(currentEnvVars, null, 2);
      
      // If it's placeholder values, provide empty values instead
      if (Object.values(currentEnvVars).every(val => val === '********')) {
        const emptyVars = {};
        Object.keys(currentEnvVars).forEach(key => {
          emptyVars[key] = '';
        });
        envVarsJson = JSON.stringify(emptyVars, null, 2);
      }
      
      const editedJson = await editor({
        message: 'Edit environment variables (JSON format):',
        default: envVarsJson,
        validate: (input) => {
          try {
            JSON.parse(input);
            return true;
          } catch (error) {
            return `Invalid JSON: ${error.message}`;
          }
        }
      });
      
      try {
        updates = JSON.parse(editedJson);
        console.log(colorizer.green(`✓ Successfully parsed environment variables.`));
      } catch (error) {
        console.log(colorizer.red(`Error parsing JSON: ${error.message}`));
        return { message: 'Invalid JSON format. Operation cancelled.' };
      }
    } else if (operation === 'import') {
      // Import from file
      const filePath = await input({
        message: 'Enter path to JSON file:',
        validate: (input) => {
          if (!fs.existsSync(input)) {
            return `File not found: ${input}`;
          }
          if (!input.endsWith('.json')) {
            return 'File must have .json extension';
          }
          return true;
        }
      });
      
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        updates = JSON.parse(fileContent);
        console.log(colorizer.green(`✓ Successfully imported environment variables from ${filePath}`));
      } catch (error) {
        console.log(colorizer.red(`Error reading or parsing file: ${error.message}`));
        return { message: `Error importing file: ${error.message}` };
      }
    } else if (operation === 'export') {
      // Export to file
      const filePath = await input({
        message: 'Enter path to save JSON file:',
        default: './env-vars.json'
      });
      
      try {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // If values are placeholders, export just the keys
        if (Object.values(currentEnvVars).every(val => val === '********')) {
          const exportObj = {};
          Object.keys(currentEnvVars).forEach(key => {
            exportObj[key] = ''; // Empty placeholder
          });
          fs.writeFileSync(filePath, JSON.stringify(exportObj, null, 2));
        } else {
          fs.writeFileSync(filePath, JSON.stringify(currentEnvVars, null, 2));
        }
        
        console.log(colorizer.green(`✓ Successfully exported environment variables to ${filePath}`));
        return { message: `Environment variables exported to ${filePath}` };
      } catch (error) {
        console.log(colorizer.red(`Error exporting to file: ${error.message}`));
        return { message: `Error exporting file: ${error.message}` };
      }
    }
    
    // If no updates or just exporting, return early
    if (Object.keys(updates).length === 0) {
      return { message: 'No changes made.' };
    }
    
    // Confirm update
    console.log(colorizer.blue('\nPreparing to update environment variables:'));
    Object.entries(updates).forEach(([key, value]) => {
      console.log(`${colorizer.bold(key)}: ${value === null ? colorizer.red('[DELETE]') : value}`);
    });
    
    const shouldDeploy = await confirm({
      message: 'Deploy these changes?',
      default: true
    });
    
    if (!shouldDeploy) {
      return { message: 'Operation cancelled.' };
    }
    
    // Update environment variables
    const result = await api.updateEnvVars(
      options.id, 
      functionData.current_version.id, 
      updates,
      options.deploy !== false // Deploy by default
    );
    
    return {
      functionId: options.id,
      functionName: functionData.name,
      oldVersionId: functionData.current_version.id,
      newVersionId: result.entity?.id,
      deployed: result.deployed,
      message: result.message,
      updates
    };
  } catch (error) {
    // Don't handle errors here - propagate to caller for consistent handling
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('update-env-vars', 'Manage environment variables for a function')
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
            if (!fs.existsSync(options.envFile)) {
              throw new Error(`File not found: ${options.envFile}`);
            }
            
            const fileContent = fs.readFileSync(options.envFile, 'utf8');
            options.env = fileContent; // Use file content as JSON string
            command.info(`Loaded environment variables from ${options.envFile}`);
          } catch (error) {
            throw new Error(`Failed to read environment variables file: ${error.message}`);
          }
        }
        
        if (options.list) {
          // Show environment variables
          command.info(`Fetching environment variables for function "${options.id}"...`);
          
          const result = await listEnvVars({
            id: options.id
          });
          
          command.success(`Function: ${result.functionName} (${result.functionId})`);
          command.info(`Current version: ${result.versionId}`);
          
          const envVars = result.environmentVariables;
          
          if (options.output) {
            // Export to file
            try {
              // Ensure directory exists
              const dir = path.dirname(options.output);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              
              // If values are placeholders, export just the keys
              if (Object.values(envVars).every(val => val === '********')) {
                const exportObj = {};
                Object.keys(envVars).forEach(key => {
                  exportObj[key] = ''; // Empty placeholder
                });
                fs.writeFileSync(options.output, JSON.stringify(exportObj, null, 2));
              } else {
                fs.writeFileSync(options.output, JSON.stringify(envVars, null, 2));
              }
              
              command.success(`Environment variables exported to ${options.output}`);
            } catch (error) {
              command.error(`Failed to export environment variables: ${error.message}`);
            }
          } else {
            // Display in terminal
            console.log(formatEnvVars(envVars));
          }
        } else if (options.interactive) {
          // Interactive mode
          const result = await interactiveEnvVars({
            id: options.id,
            deploy: options.deploy
          });
          
          if (result.message) {
            command.info(result.message);
          }
          
          if (result.deployed) {
            command.success(`Environment variables updated and deployed successfully.`);
            command.info(`New version: ${result.newVersionId}`);
          } else if (result.newVersionId) {
            command.success(`Environment variables updated but not deployed.`);
            command.info(`New version created: ${result.newVersionId}`);
            command.info(`Use 'deploy-version' command to deploy it.`);
          }
        } else if (options.env) {
          // Update environment variables
          command.info(`Updating environment variables for function "${options.id}"...`);
          
          // Parse environment variables
          let envVars;
          try {
            envVars = parseAndValidateJson(options.env);
          } catch (error) {
            throw new Error(`Invalid JSON format for environment variables: ${error.message}`);
          }
          
          const result = await updateEnvVars({
            id: options.id,
            env: envVars,
            deploy: options.deploy
          });
          
          if (result.deployed) {
            command.success(`Environment variables updated and deployed successfully.`);
            command.info(`New version: ${result.newVersionId}`);
          } else {
            command.success(`Environment variables updated but not deployed.`);
            command.info(`New version created: ${result.newVersionId}`);
            command.info(`Use 'deploy-version' command to deploy it.`);
          }
        } else {
          command.info('Please specify an operation: --list, --env, --env-file, or --interactive');
        }
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

// Export the default object for compatibility with existing imports
export default {
  listEnvVars,
  updateEnvVars,
  interactiveEnvVars
};
