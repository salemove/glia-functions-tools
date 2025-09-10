/**
 * Command to select an applet interactively
 * 
 * This command provides an interactive interface for selecting and managing applets.
 * It can be used directly from the CLI or from other commands.
 */
import { selectApplet, selectAppletOperation, executeAppletOperation } from '../../cli/applet-selector.js';
import BaseCommand from '../../cli/base-command.js';
import { routeCommand } from '../../cli/command-router.js';
import { confirm } from '@inquirer/prompts';

/**
 * Select an applet interactively and perform operations on it
 * 
 * @param {Object} options - Command options
 * @param {string} options.scope - Filter by scope (engagement, global)
 * @param {boolean} options.showDescription - Whether to show descriptions
 * @returns {Promise<Object|null>} Selected applet or operation result
 */
export async function selectAppletCommand(options = {}) {
  try {
    // First select an applet
    const applet = await selectApplet({
      message: options.message || 'Select an applet:',
      scope: options.scope,
      showDescription: options.showDescription !== false
    });
    
    // If canceled or no applet found, return null
    if (!applet || applet.canceled) {
      return null;
    }
    
    // If options.selectOnly is true, just return the selected applet
    if (options.selectOnly) {
      return applet;
    }
    
    // Otherwise, show operations menu
    const operation = await selectAppletOperation(applet);
    
    // If no operation selected, return the applet
    if (!operation) {
      return applet;
    }
    
    // Execute the selected operation
    const success = await executeAppletOperation(operation, applet, routeCommand);
    
    // Ask if user wants to perform another operation on this applet
    if (success && !options.noRepeat) {
      const continueOperations = await confirm({
        message: 'Would you like to perform another operation on this applet?',
        default: true
      });
      
      if (continueOperations) {
        // Recurse to get another operation for the same applet
        return selectAppletCommand({ 
          ...options,
          preselectedApplet: applet 
        });
      }
    }
    
    return { applet, operation, success };
  } catch (error) {
    console.error('Error during applet selection:', error);
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('select-applet', 'Select and manage applets interactively')
    .option('--scope <scope>', 'Filter by scope (engagement, global)')
    .option('--no-description', 'Hide descriptions in selector')
    .action(async (options) => {
      try {
        await selectAppletCommand({
          scope: options.scope,
          showDescription: options.description !== false
        });
        
        // Ask if they want to select another applet
        const continueSelecting = await confirm({
          message: 'Would you like to select another applet?',
          default: true
        });
        
        if (continueSelecting) {
          await main();
        }
      } catch (error) {
        command.error(`Failed to select applet: ${error.message}`);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default selectAppletCommand;