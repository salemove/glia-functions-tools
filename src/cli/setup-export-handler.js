/**
 * Export handler setup CLI flow
 * 
 * This module provides a function for the CLI to create export event handlers.
 */

import { routeCommand } from './command-router.js';
import { handleError } from './error-handler.js';

/**
 * Set up a new export event handler
 * 
 * @returns {Promise<boolean>} False to continue CLI flow
 */
export async function CLISetupExportHandler() {
  try {
    // Use the setupExportHandler command with interactive mode
    await routeCommand('setup-export-handler', {
      interactive: true
    });
    
    return false;
  } catch (error) {
    handleError(error);
    return false;
  }
}

export default CLISetupExportHandler;