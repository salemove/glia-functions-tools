/**
 * Command router for CLI
 * 
 * This file contains logic for routing commands to appropriate handlers
 */

import * as commands from '../commands/index.js';
import { handleError } from './error-handler.js';
import { refreshBearerTokenIfNeeded } from '../lib/config.js';

/**
 * Route command to appropriate handler
 * @param {string} commandName - The command name to execute
 * @param {object} options - Command options
 * @param {boolean} [handleErrors=true] - Whether to handle errors internally
 * @returns {Promise<any>} Result of the command execution
 */
export async function routeCommand(commandName, options = {}, handleErrors = true) {
  // Attempt to refresh the token if needed before executing any command
  // Skip token refresh for auth-related commands
  const authCommands = ['create-profile', 'list-profiles', 'switch-profile', 'delete-profile'];
  if (!authCommands.includes(commandName)) {
    await refreshBearerTokenIfNeeded();
  }
  try {
    let result;
    
    // Execute the corresponding command
    switch (commandName) {
      // Core function management commands
      case 'list-functions':
        result = await commands.listFunctions(options);
        break;
      case 'create-function':
        result = await commands.createFunction(options);
        break;
      case 'update-function':
        result = await commands.updateFunction(options);
        break;
      case 'update-env-vars':
        result = await commands.updateEnvVars(options);
        break;
      case 'fetch-logs':
        result = await commands.fetchLogs(options);
        break;
      case 'invoke-function':
        result = await commands.invokeFunction(options);
        break;
      case 'deploy':
      case 'create-and-deploy-version':
        result = await commands.createAndDeployVersion(options);
        break;
      
      // Profile management commands
      case 'create-profile':
        result = await commands.createProfile(options);
        break;
      case 'list-profiles':
        result = await commands.listProfiles(options);
        break;
      case 'switch-profile':
        result = await commands.switchProfile(options);
        break;
      case 'delete-profile':
        result = await commands.deleteProfile(options);
        break;
        
      // Project and template commands
      case 'init':
        result = await commands.init(options);
        break;
      case 'list-templates':
        result = await commands.listTemplates(options);
        break;
      case 'dev':
        result = await commands.dev(options);
        break;
        
      default:
        throw new Error(`Unknown command: ${commandName}`);
    }
    
    // Return the result for processing by the caller
    return result;
  } catch (error) {
    if (handleErrors) {
      // Only handle errors if requested (allows caller to handle errors themselves)
      handleError(error);
      // Let caller decide whether to exit
      return { success: false, error };
    } else {
      // Propagate the error for the caller to handle
      throw error;
    }
  }
}
