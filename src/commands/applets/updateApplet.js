/**
 * Command to update an applet
 *
 * This command updates an existing applet.
 */
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import BaseCommand from '../../cli/base-command.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Update an applet
 * 
 * @param {Object} options - Command options
 * @param {string} options.id - Applet ID
 * @param {string} options.path - Path to applet HTML file (optional)
 * @param {string} options.name - New applet name (optional)
 * @param {string} options.description - New applet description (optional)
 * @param {string} options.scope - New applet scope (optional)
 * @returns {Promise<Object>} Updated applet details
 */
export async function updateApplet(options) {
  try {
    // Validate inputs
    if (!options.id) {
      throw new Error('Applet ID is required');
    }
    
    // Check if we have any update fields
    if (!options.path && !options.name && !options.description && !options.scope) {
      throw new Error('At least one update field is required (path, name, description, or scope)');
    }
    
    // Check if file exists if path is provided
    let appletHtml = null;
    if (options.path) {
      const filePath = path.resolve(process.cwd(), options.path);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Read the file
      appletHtml = fs.readFileSync(filePath, 'utf8');
    }
    
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Update the applet
    const updateOptions = {
      name: options.name,
      description: options.description,
      scope: options.scope
    };
    
    if (appletHtml) {
      updateOptions.source = appletHtml;
    }
    
    const applet = await api.updateApplet(options.id, updateOptions);
    
    return applet;
  } catch (error) {
    console.error('Error updating applet:', error);
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('update-applet', 'Update an applet')
    .requiredOption('--id <id>', 'Applet ID')
    .option('--path <path>', 'Path to new applet HTML file')
    .option('--name <name>', 'New applet name')
    .option('--description <description>', 'New applet description')
    .option('--scope <scope>', 'New applet scope (engagement or global)')
    .action(async (options) => {
      try {
        // Validate scope if provided
        if (options.scope && !['engagement', 'global'].includes(options.scope)) {
          command.error('Invalid scope. Must be either "engagement" or "global"');
          return;
        }
        
        // Check if we have any update fields
        if (!options.path && !options.name && !options.description && !options.scope) {
          command.error('At least one update field is required (--path, --name, --description, or --scope)');
          return;
        }
        
        // Show progress
        command.info(`Updating applet with ID "${options.id}"...`);
        
        // Update the applet
        const applet = await updateApplet({
          id: options.id,
          path: options.path,
          name: options.name,
          description: options.description,
          scope: options.scope
        });
        
        // Display success
        command.success('Applet updated successfully!');
        command.log(`\nApplet ID: ${applet.id}`);
        command.log(`Applet Name: ${applet.name}`);
        command.log(`Scope: ${applet.scope}`);
        
        if (applet.source_url) {
          command.log(`Source URL: ${applet.source_url}`);
        }
      } catch (error) {
        command.error(`Failed to update applet: ${error.message}`);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default updateApplet;