/**
 * Command to list applets
 *
 * This command lists all available applets for a site.
 */
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import BaseCommand from '../../cli/base-command.js';

/**
 * List applets
 * 
 * @param {Object} options - Command options
 * @param {string} options.siteId - Filter by site ID
 * @param {string} options.scope - Filter by scope (engagement, global)
 * @param {boolean} options.detailed - Show detailed output
 * @returns {Promise<Object>} List of applets
 */
export async function listApplets(options) {
  try {
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    try {
      // List applets
      const result = await api.listApplets({
        siteId: options.siteId,
        scope: options.scope
      });
      
      return result;
    } catch (error) {
      // Check for authorization error (403) or other errors
      if (error.statusCode === 403 ||
          (error.originalError && error.originalError.statusCode === 403)) {
        // Return empty array to handle gracefully - match expected structure
        return { axons: [] };
      }
      throw error;
    }
  } catch (error) {
    console.error('Error listing applets:', error);
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('list-applets', 'List available applets')
    .option('--site-id <siteId>', 'Filter by site ID')
    .option('--scope <scope>', 'Filter by scope (engagement, global)')
    .option('-d, --detailed', 'Show detailed output', false)
    .action(async (options) => {
      try {
        // List applets
        const result = await listApplets(options);

        // Display results - handle different API response structures
        const applets = result?.axons || result?.items || [];
        
        if (!applets || applets.length === 0) {
          command.info('No applets found or you may not have permission to view applets.');
          return;
        }
        
        if (options.detailed) {
          command.info('Applets (detailed):');
          console.log(JSON.stringify(result, null, 2));
        } else {
          command.info(`Found ${applets.length} applets:`);
          
          // Create table format
          console.log('\nID                                     Name                  Scope       Type');
          console.log('─────────────────────────────────────── ───────────────────── ─────────── ───────');
          
          applets.forEach(applet => {
            const id = applet.id.padEnd(38).substring(0, 38);
            const name = (applet.name || '').padEnd(20).substring(0, 20);
            const scope = (applet.scope || '').padEnd(10).substring(0, 10);
            const type = applet.type || '';
            
            console.log(`${id} ${name} ${scope} ${type}`);
          });
          
          console.log(''); // Extra line at the end
          
          // Show usage tip
          command.info('Tip: Use --detailed for more information');
        }
      } catch (error) {
        if (error.statusCode === 403 || 
            (error.originalError && error.originalError.statusCode === 403)) {
          command.warning('You do not have permission to view applets. Please check that your API key has the "applets:read" or "list:applets" permission.');
          command.info('No applets could be displayed.');
        } else {
          command.error(`Failed to list applets: ${error.message}`);
        }
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default listApplets;