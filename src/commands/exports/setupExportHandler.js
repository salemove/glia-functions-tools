/**
 * Set up an export event handler
 * 
 * This command creates a new Glia Functions project for handling
 * export events from the Glia platform.
 */

import path from 'path';
import { BaseCommand } from '../../cli/base-command.js';
import { 
  getExportEventMetadata, 
  getExportEventMetadataSync 
} from '../../utils/export-events-registry.js';
import { createFromTemplate } from '../../utils/unified-template-manager.js';

/**
 * Set up an export event handler
 * 
 * @param {Object} options - Command options
 * @param {string} options.eventType - Export event type
 * @param {string} options.outputDir - Directory where the project will be created
 * @param {boolean} options.interactive - Whether to run in interactive mode
 * @param {Object} options.variables - Template variables
 * @param {BaseCommand} command - Command instance for output
 * @returns {Promise<Object|null>} Results of handler creation or null if cancelled
 */
export default async function setupExportHandler(options, command = new BaseCommand()) {
  const { eventType, outputDir, interactive = true, ...variables } = options;
  
  try {
    let setupConfig = { ...variables };
    
    // Run wizard if interactive mode is enabled
    if (interactive) {
      // Import wizard only when needed
      const { runExportWizard } = await import('../../cli/export-wizard.js');
      const wizardResult = await runExportWizard(options);
      
      if (wizardResult.canceled) {
        command.info('Export handler setup canceled');
        return null;
      }
      
      setupConfig = {
        ...setupConfig,
        ...wizardResult
      };
    }
    
    // Validate event type
    const eventMetadata = await getExportEventMetadata(setupConfig.eventType || eventType, true);
    if (!eventMetadata) {
      throw new Error(`Invalid export event type: ${setupConfig.eventType || eventType}`);
    }
    
    // Determine template to use
    const templateName = eventMetadata.templateName;
    
    // Set output directory
    const targetDir = outputDir || path.join(process.cwd(), setupConfig.projectName || `${setupConfig.eventType}-handler`);
    
    // Create template variables
    const templateVariables = {
      projectName: setupConfig.projectName,
      description: `Handler for ${eventMetadata.displayName} events`,
      includeForwarding: setupConfig.forwarding ? 'true' : 'false',
      forwardingUrl: setupConfig.forwarding?.url || '',
      authType: setupConfig.forwarding?.authType || 'none',
      includeFiltering: setupConfig.filtering ? 'true' : 'false',
      includeTypescript: setupConfig.typescript ? 'true' : 'false',
      eventType: setupConfig.eventType || eventType,
      version: '0.1.0'
    };
    
    // Create from template
    command.info(`Creating export handler from template "${templateName}"...`);
    const result = await createFromTemplate(templateName, targetDir, {
      variables: templateVariables,
      conditions: {
        includeForwarding: setupConfig.forwarding !== null,
        includeFiltering: setupConfig.filtering,
        includeTypescript: setupConfig.typescript
      }
    });
    
    command.success(`Export handler created successfully in ${targetDir}`);
    command.info('Next steps:');
    command.info(`1. Navigate to the project: cd ${targetDir}`);
    command.info('2. Install dependencies: npm install');
    command.info('3. Set up your environment variables in .env');
    command.info('4. Test locally: npm run dev');
    command.info('5. Deploy: npm run deploy');
    
    return {
      template: templateName,
      outputDir: targetDir,
      success: true,
      files: result.files
    };
  } catch (error) {
    command.error(`Error setting up export handler: ${error.message}`);
    throw error;
  }
}