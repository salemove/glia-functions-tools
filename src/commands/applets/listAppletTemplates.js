/**
 * Command to list available applet templates
 */
import { listTemplates } from '../../utils/unified-template-manager.js';
import BaseCommand from '../../cli/base-command.js';

/**
 * List available applet templates
 * 
 * @param {Object} options - Command options
 * @returns {Promise<Object>} List of templates
 */
export async function listAppletTemplates(options) {
  const command = new BaseCommand('list-applet-templates', 'List available applet templates');
  
  try {
    // Get templates filtered by type 'applet'
    const templates = await listTemplates({ type: 'applet' });
    
    if (templates.length === 0) {
      command.info('No applet templates found');
      return { templates: [] };
    }
    
    command.info(`Found ${templates.length} applet templates:`);
    
    // Format output as list for console
    templates.forEach(template => {
      command.info(`- ${template.displayName || template.name}: ${template.description || ''} (${template.version || 'no version'})`);
    });
    
    command.info('\nTo create an applet from a template, run:');
    command.info('glia create-applet --template <template-name>');
    
    return { templates };
  } catch (error) {
    command.error(`Error listing applet templates: ${error.message}`);
    throw error;
  }
}

export default listAppletTemplates;