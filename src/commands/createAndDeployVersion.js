/**
 * Command to create and deploy a function version
 *
 * This command bundles a function's code, creates a new version,
 * and deploys it as the main version.
 */
import fs from 'fs/promises';
import { parseAndValidateJson } from '../lib/validation.js';
import { getApiConfig } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';
import BaseCommand from '../cli/base-command.js';

/**
 * Create and deploy a function version
 * 
 * @param {Object} options - Command options
 * @param {string} options.functionId - Function ID
 * @param {string} options.codePath - Path to function code
 * @param {Object} options.envVars - Environment variables
 * @param {string} options.compatibilityDate - Compatibility date
 * @returns {Promise<Object>} Deployment response
 */
export async function createAndDeployVersion(options) {
  try {
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Read function code
    console.log(`Reading function code from ${options.codePath}...`);
    const code = await fs.readFile(options.codePath, 'utf8');
    
    // Create version options
    const versionOptions = {
      environmentVariables: options.envVars,
      compatibilityDate: options.compatibilityDate
    };
    
    // Create version
    console.log('Creating new function version...');
    const version = await api.createVersion(options.functionId, code, versionOptions);
    console.log('New version created:', version);
    
    // Wait for version to be ready by polling the task
    console.log('Waiting for version creation to complete...');
    
    // Poll until version is ready (up to 3 minutes)
    const maxAttempts = 36; // 36 attempts * 5 seconds = 3 minutes
    let attempts = 0;
    let versionId;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // Get version details from task
      const task = await api.makeRequest(version.self);
      
      if (task.status === 'completed') {
        versionId = task.entity.id;
        console.log(`Version creation completed: ${versionId}`);
        break;
      } else if (task.status === 'failed') {
        throw new Error(`Version creation failed: ${task.error || 'Unknown error'}`);
      }
      
      // Wait 5 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    if (!versionId) {
      throw new Error('Version creation timed out after 3 minutes');
    }
    
    // Deploy version
    console.log(`Deploying version ${versionId}...`);
    const deployment = await api.deployVersion(options.functionId, versionId);
    console.log('Deployment successful:', deployment);
    
    return deployment;
  } catch (error) {
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('create-and-deploy-version', 'Create and deploy a function version')
    .requiredOption('--function-id <id>', 'Function ID')
    .requiredOption('--path <path>', 'Path to function code')
    .option('--env <json>', 'Environment variables as JSON string', '{}')
    .option('--compatibility-date <date>', 'Compatibility date (YYYY-MM-DD)', null)
    .option('--deploy', 'Whether to deploy the version after creation', true)
    .action(async (options) => {
      // Parse environment variables
      let envVars;
      try {
        envVars = parseAndValidateJson(options.env);
      } catch (error) {
        command.error(`Invalid JSON for environment variables: ${error.message}`);
        process.exit(1);
      }
      
      command.info(`Creating version for function ${options.functionId}...`);
      
      try {
        const result = await createAndDeployVersion({
          functionId: options.functionId,
          codePath: options.path,
          envVars,
          compatibilityDate: options.compatibilityDate,
          deploy: options.deploy !== false
        });
        
        command.success('Version created and deployed successfully');
        command.info('Deployment details:');
        console.log(command.formatJson(result));
      } catch (error) {
        command.error(`Deployment failed: ${error.message}`);
        
        // Provide more helpful error messages based on common issues
        if (error.message.includes('not found')) {
          command.info('Tip: Check that the function ID is correct.');
        } else if (error.message.includes('file')) {
          command.info('Tip: Make sure the function code file exists and is readable.');
        }
        
        process.exit(1);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default createAndDeployVersion;
