/**
 * Applet selector for Glia Functions CLI
 * 
 * Provides a consistent interface for selecting applets in the interactive CLI
 */

import { select, input, confirm } from '@inquirer/prompts';
import colorizer from '../utils/colorizer.js';

import { getApiConfig } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';

/**
 * Get a list of applets from the API
 * 
 * @param {Object} options - Options for filtering applets
 * @param {string} options.siteId - Site ID to filter by
 * @param {string} options.scope - Scope to filter by (engagement, global)
 * @returns {Promise<Array<Object>>} - List of applets
 */
export async function getApplets(options = {}) {
  try {
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Verify site ID is available
    if (!apiConfig.siteId && !options.siteId) {
      console.error('No site ID found in configuration or options. Please set an active site first.');
      throw new Error('Missing site ID. Please set an active site first via "Change active site" option.');
    }
    
    // Debug info for troubleshooting
    console.log(`[DEBUG] getApplets using siteId: ${options.siteId || apiConfig.siteId}`);
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // List applets
    const result = await api.listApplets({
      siteId: options.siteId,  // Will use API client's siteId if undefined
      scope: options.scope
    });
    
    // Return applets array, handling different response formats
    return result?.axons || [];
  } catch (error) {
    console.error('Error fetching applets:', error);
    return [];
  }
}

/**
 * Interactive applet selector
 * 
 * @param {Object} options - Selector options
 * @param {string} options.message - Prompt message
 * @param {string} options.scope - Filter by scope (engagement, global)
 * @param {boolean} options.showDescription - Whether to show descriptions
 * @param {Function} options.filter - Custom filter function
 * @returns {Promise<Object|null>} Selected applet or null if canceled
 */
export async function selectApplet(options = {}) {
  try {
    const { 
      message = 'Select an applet:',
      scope = null,
      showDescription = true,
      filter = null
    } = options;
    
    // Fetch applets
    console.log(colorizer.blue('Fetching applets, please wait...'));
    const applets = await getApplets({ scope });
    
    if (!applets || applets.length === 0) {
      console.log(colorizer.yellow('No applets found. You may not have permission to view applets.'));
      return { canceled: true };
    }
    
    // Apply custom filter if provided
    const filteredApplets = filter ? applets.filter(filter) : applets;
    
    // Transform into choices for select
    const choices = filteredApplets.map(applet => ({
      name: applet.name,
      value: applet.id,
      description: showDescription ? (applet.description || `Type: ${applet.type || 'custom'}`) : undefined
    }));
    
    // Always add back option
    choices.push({
      name: '(Back)',
      value: 'back'
    });
    
    // Format for better readability in the CLI
  // Show site ID information to help with troubleshooting
  const apiConfig = await getApiConfig();
  console.log(colorizer.blue(`Using site ID: ${apiConfig.siteId || 'None - please set a site ID'}`));
  console.log(`\nFound ${choices.length - 1} applet${choices.length - 1 !== 1 ? 's' : ''}\n`);
  
  // Show the selector
  const appletId = await select({
    message,
    choices
  });
  
  if (appletId === 'back') {
    return { canceled: true };
  }
    
    // Find the selected applet and return it
    const selectedApplet = filteredApplets.find(a => a.id === appletId);
    return selectedApplet || null;
  } catch (error) {
    console.error('Error selecting applet:', error);
    return { canceled: true, error };
  }
}

/**
 * Interactive applet operation selector
 * 
 * @param {Object} applet - Applet object
 * @returns {Promise<string|null>} Selected operation or null if canceled
 */
export async function selectAppletOperation(applet) {
  if (!applet) return null;
  
  console.log(colorizer.bold(`\nSelected applet: ${applet.name}`));
  console.log(`ID: ${applet.id}`);
  console.log(`Type: ${applet.type || 'custom'}`);
  console.log(`Scope: ${applet.scope || 'engagement'}`);
  if (applet.description) console.log(`Description: ${applet.description}`);
  console.log(`Source URL: ${applet.source_url || 'N/A'}\n`);
  
  // Show available operations
  const operation = await select({
    message: 'Select operation:',
    choices: [
      {
        name: 'View details',
        value: 'view',
        description: 'Show full applet details'
      },
      {
        name: 'Update applet',
        value: 'update',
        description: 'Update this applet with new HTML or settings'
      },
      {
        name: 'Delete applet',
        value: 'delete',
        description: 'Delete this applet'
      },
      {
        name: '(Back)',
        value: 'back'
      }
    ]
  });
  
  return operation === 'back' ? null : operation;
}

/**
 * Execute an applet operation using the appropriate command
 * 
 * @param {string} operation - Operation to execute
 * @param {Object} applet - Applet object
 * @param {Function} routeCommand - Function to route to a command
 * @returns {Promise<boolean>} Success status
 */
export async function executeAppletOperation(operation, applet, routeCommand) {
  if (!operation || !applet) return false;
  
  try {
    switch (operation) {
      case 'view':
        console.log(colorizer.bold('\nApplet Details:'));
        console.log(JSON.stringify(applet, null, 2));
        return true;
        
      case 'update':
        return await routeCommand('update-applet', { 
          id: applet.id, 
          interactive: true 
        });
        
      case 'delete':
        const confirmDelete = await confirm({
          message: `Are you sure you want to delete applet "${applet.name}"?`,
          default: false
        });
        
        if (confirmDelete) {
          return await routeCommand('delete-applet', { id: applet.id });
        }
        return false;
        
      default:
        console.log(colorizer.yellow(`Unknown operation: ${operation}`));
        return false;
    }
  } catch (error) {
    console.error(`Error executing applet operation: ${error.message}`);
    return false;
  }
}