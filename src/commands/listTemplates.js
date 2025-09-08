/**
 * Command to list available function templates
 *
 * This command lists all available function templates with their descriptions
 */
import { listTemplates } from '../utils/unified-template-manager.js';
import BaseCommand from '../cli/base-command.js';

/**
 * List available function templates
 * 
 * @param {Object} options - Command options
 * @returns {Promise<Array>} Available templates
 */
export async function listTemplatesCommand(options) {
  try {
    console.log('Fetching available templates...');
    const templates = await listTemplates({ type: 'function' });
    
    // Display templates to console
    if (templates.length === 0) {
      console.log('No templates available');
    } else {
      console.log('\nAvailable function templates:');
      templates.forEach(template => {
        console.log(`- ${template.name}: ${template.description}`);
      });
      console.log('\nUse create-function command with --template option to create a function from a template');
    }
    
    return templates;
  } catch (error) {
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('list-templates', 'List available function templates')
    .option('--format <format>', 'Output format (text, json)', 'text')
    .action(async (options) => {
      try {
        const templates = await listTemplatesCommand(options);
        
        if (options.format === 'json') {
          command.successJson(templates);
        } else {
          command.success(`Found ${templates.length} templates`);
        }
      } catch (error) {
        command.error(`Failed to list templates: ${error.message}`);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default listTemplatesCommand;