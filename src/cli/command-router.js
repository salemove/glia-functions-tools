/**
 * Command router for CLI
 * 
 * This file contains logic for routing commands to appropriate handlers
 */

import * as commands from '../commands/index.js';
import { handleError } from './error-handler.js';

/**
 * Route command to appropriate handler
 * @param {string} commandName - The command name to execute
 * @param {object} options - Command options
 * @returns {Promise<any>} Result of the command execution
 */
export async function routeCommand(commandName, options = {}) {
  try {
    let result;
    
    // Execute the corresponding command
    switch (commandName) {
      case 'list-functions':
        result = await commands.listFunctions(options);
        // DO NOT process exit here - let the calling function handle the result
        return result;
      case 'create-function':
        result = await commands.createFunction(options);
        break;
      case 'update-function':
        result = await commands.updateFunction(options);
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
      default:
        throw new Error(`Unknown command: ${commandName}`);
    }
    
    // Return the result for processing by the caller
    return result;
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}
