/**
 * Deploy Project Command
 * 
 * This command deploys a complete project including functions, applets, and KV data
 * from a project manifest file.
 */

import path from 'path';
import fs from 'fs/promises';
import { deployProject } from '../../lib/project-deployer.js';
import { getApiConfig } from '../../lib/config.js';

/**
 * Execute the deploy-project command
 * 
 * @param {Object} options - Command options
 * @param {string} options.manifest - Path to project manifest file
 * @param {boolean} [options.dryRun] - Only validate, don't deploy
 * @param {boolean} [options.skipKvData] - Skip populating KV store data
 * @param {boolean} [options.skipFunctions] - Skip function deployment
 * @param {boolean} [options.skipApplets] - Skip applet deployment
 * @param {boolean} [options.rollbackOnFailure] - Rollback on failure
 * @param {boolean} [options.json] - Output results as JSON
 * @param {object} [options.command] - Commander command object (for output formatting)
 * @returns {Promise<object>} Command result
 */
export default async function deployProjectCommand(options) {
  const command = options.command;
  
  try {
    // Normalize options
    const manifestPath = options.manifest || 'glia-project.json';
    
    // Logger function that respects command output format
    const logger = (message) => {
      if (command) {
        command.info(message);
      } else if (!options.json) {
        console.log(message);
      }
    };
    
    // Make sure we can access the manifest file
    try {
      await fs.access(manifestPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Project manifest file not found: ${manifestPath}`);
      }
      throw error;
    }
    
    // Check API configuration
    try {
      await getApiConfig();
    } catch (error) {
      throw new Error(`API configuration error: ${error.message}. Please ensure you have a valid profile configured.`);
    }
    
    // Deploy the project
    const result = await deployProject(manifestPath, {
      dryRun: options.dryRun,
      skipKvData: options.skipKvData,
      skipFunctions: options.skipFunctions,
      skipApplets: options.skipApplets,
      rollbackOnFailure: options.rollbackOnFailure !== false,
      logger
    });
    
    // Print success message
    if (command && !options.json && !options.dryRun) {
      command.success('Project deployment completed successfully!');
      
      // Print deployment summary
      const state = result.deploymentState || {};
      command.info('Deployment summary:');
      
      if (state.functions > 0) {
        command.info(`- Functions: ${state.functions} created, ${state.functionVersions} versions, ${state.functionDeployments} deployments`);
      }
      
      if (state.applets > 0) {
        command.info(`- Applets: ${state.applets} deployed`);
      }
      
      if (state.kvPairs > 0) {
        command.info(`- KV Store: ${state.kvPairs} pairs populated`);
      }
    }
    
    return {
      success: true,
      ...result
    };
    
  } catch (error) {
    // Print error message
    if (command) {
      command.error(`Project deployment failed: ${error.message}`);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}