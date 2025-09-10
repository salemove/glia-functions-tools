/**
 * Command to deploy an applet
 *
 * This command deploys an HTML applet to a Glia site.
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
 * Deploy an applet
 * 
 * @param {Object} options - Command options
 * @param {string} options.path - Path to applet HTML file
 * @param {string} options.name - Applet name
 * @param {string} options.description - Applet description
 * @param {string} options.ownerSiteId - Owner site ID
 * @param {string} options.scope - Applet scope (engagement or global)
 * @returns {Promise<Object>} Deployed applet details
 */
export async function deployApplet(options) {
  try {
    // Validate inputs
    if (!options.path) {
      throw new Error('Path to applet HTML file is required');
    }
    
    if (!options.ownerSiteId) {
      throw new Error('Owner site ID is required');
    }
    
    if (!options.name) {
      throw new Error('Applet name is required');
    }
    
    // Check if file exists
    const filePath = path.resolve(process.cwd(), options.path);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Read the file
    const appletHtml = fs.readFileSync(filePath, 'utf8');
    
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Create the applet
    const createOptions = {
      name: options.name,
      description: options.description || '',
      ownerSiteId: options.ownerSiteId,
      source: appletHtml,
      scope: options.scope || 'engagement'
    };
    
    const applet = await api.createApplet(createOptions);
    
    return applet;
  } catch (error) {
    console.error('Error deploying applet:', error);
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('deploy-applet', 'Deploy an applet')
    .requiredOption('--path <path>', 'Path to applet HTML file')
    .requiredOption('--owner-site-id <siteId>', 'Owner site ID')
    .requiredOption('--name <name>', 'Applet name')
    .option('--description <description>', 'Applet description')
    .option('--scope <scope>', 'Applet scope (engagement or global)', 'engagement')
    .action(async (options) => {
      try {
        // Validate scope
        if (options.scope && !['engagement', 'global'].includes(options.scope)) {
          command.error('Invalid scope. Must be either "engagement" or "global"');
          return;
        }
        
        // Show progress
        command.info(`Deploying applet "${options.name}"...`);
        
        // Deploy the applet
        const applet = await deployApplet({
          path: options.path,
          name: options.name,
          description: options.description,
          ownerSiteId: options.ownerSiteId,
          scope: options.scope
        });
        
        // Display success
        command.success('Applet deployed successfully!');
        command.log(`\nApplet ID: ${applet.id}`);
        command.log(`Applet Name: ${applet.name}`);
        command.log(`Scope: ${applet.scope}`);
        
        if (applet.source_url) {
          command.log(`Source URL: ${applet.source_url}`);
        }
      } catch (error) {
        command.error(`Failed to deploy applet: ${error.message}`);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default deployApplet;