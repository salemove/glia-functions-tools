/**
 * Command to create a new applet
 *
 * This command creates a new applet using a template and optionally deploys it.
 */
import { getApiConfig } from '../../lib/config.js';
import GliaApiClient from '../../lib/api.js';
import BaseCommand from '../../cli/base-command.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
  createAppletFromTemplate, 
  listAppletTemplates
} from '../../utils/unified-template-manager.js';
import { validateTemplateVariables } from '../../utils/template-engine.js';
import { input, select, checkbox, confirm } from '@inquirer/prompts';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a new applet
 * 
 * @param {Object} options - Command options
 * @param {string} options.name - Applet name
 * @param {string} options.description - Applet description
 * @param {string} options.template - Template to use for applet
 * @param {string} options.output - Output directory path
 * @param {string} options.ownerSiteId - Owner site ID
 * @param {boolean} options.deploy - Whether to deploy the applet
 * @param {string} options.scope - Applet scope (engagement or global)
 * @returns {Promise<Object>} Created applet details
 */
export async function createApplet(options) {
  try {
    let result = {};
    const command = new BaseCommand('create-applet', 'Create a new applet');
    
    // List templates if requested
    if (options.listTemplates) {
      const templates = await listAppletTemplates();
      
      command.info('\nAvailable applet templates:');
      templates.forEach(template => {
        command.log(`- ${template.displayName}: ${template.description}`);
      });
      
      return { templates };
    }
    
    // Validate template name if specified
    if (options.template) {
      const templates = await listAppletTemplates();
      const templateExists = templates.some(t => t.name === options.template);
      
      if (!templateExists) {
        throw new Error(`Template "${options.template}" not found. Use --list-templates to see available templates.`);
      }
    } else {
      throw new Error('Template name is required. Use --list-templates to see available templates.');
    }
    
    // Create applet from template
    const outputDir = options.output || path.resolve(process.cwd(), options.name.replace(/\s+/g, '-'));
    
    command.info(`Creating applet from template "${options.template}"...`);
    
    // Prepare template variables
    const variables = {
      appletName: options.name,
      projectName: options.name, // Add projectName for project manifest compatibility
      description: options.description || `A Glia applet created from template "${options.template}"`,
      authorName: options.author || ''
    };
    
    // Get the template object and validate variables
    const { getTemplate } = await import('../../utils/unified-template-manager.js');
    const templateObj = await getTemplate(options.template, 'applet');
    
    // Validate template variables
    const validation = validateTemplateVariables(templateObj, variables);
    if (!validation.valid) {
      throw new Error(`Invalid template variables: ${validation.errors.join(', ')}`);
    }
    
    // Create applet files from template
    const createResult = await createAppletFromTemplate(options.template, outputDir, variables);
    result.outputDir = outputDir;
    result.files = createResult.files;
    result.manifest = createResult.manifest;
    
    command.success(`Applet files created at: ${outputDir}`);
    
    // If a project manifest was generated, show info
    if (result.manifest) {
      command.info(`\nProject manifest created: glia-project.json`);
      command.info(`You can deploy this project with: glia-functions deploy-project --manifest "${path.join(outputDir, 'glia-project.json')}"`);
    }
    
    // Deploy the applet if requested
    if (options.deploy) {
      // Check if we have an HTML file to deploy
      let appletHtmlPath = '';
      
      if (options.template === 'basic-html') {
        // For basic HTML, the applet file is directly created
        appletHtmlPath = path.join(outputDir, 'applet.html');
      } else if (options.template === 'react-app') {
        // For React, we need to build it first
        command.info('Building React applet...');
        
        try {
          // Change to output directory
          const cwd = process.cwd();
          process.chdir(outputDir);
          
          // Install dependencies
          command.info('Installing dependencies...');
          const { execSync } = require('child_process');
          execSync('npm install', { stdio: 'inherit' });
          
          // Build the project
          command.info('Building project...');
          execSync('npm run build', { stdio: 'inherit' });
          
          // Reset working directory
          process.chdir(cwd);
          
          // Check if applet.html was created
          appletHtmlPath = path.join(outputDir, 'applet.html');
          
          if (!fs.existsSync(appletHtmlPath)) {
            throw new Error('Failed to create applet.html during build');
          }
        } catch (error) {
          throw new Error(`Error building React applet: ${error.message}`);
        }
      }
      
      if (!appletHtmlPath || !fs.existsSync(appletHtmlPath)) {
        throw new Error('Applet HTML file not found for deployment');
      }
      
      // Deploy the applet
      command.info('Deploying applet...');
      
      // Get API configuration
      const apiConfig = await getApiConfig();
      const api = new GliaApiClient(apiConfig);
      
      // Validate owner site ID
      if (!options.ownerSiteId) {
        throw new Error('Owner site ID is required for deployment');
      }
      
      // Read the applet HTML
      const appletHtml = fs.readFileSync(appletHtmlPath, 'utf8');
      
      // Create the applet
      const createOptions = {
        name: options.name,
        description: options.description || `Applet created from template "${options.template}"`,
        ownerSiteId: options.ownerSiteId,
        source: appletHtml,
        scope: options.scope || 'engagement'
      };
      
      const applet = await api.createApplet(createOptions);
      
      command.success(`Applet deployed with ID: ${applet.id}`);
      result.applet = applet;
    }
    
    return result;
    
  } catch (error) {
    console.error('Error creating applet:', error);
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('create-applet', 'Create a new applet')
    .option('--name <name>', 'Applet name')
    .option('--description <description>', 'Applet description', '')
    .option('--template <template>', 'Template to use for applet')
    .option('--output <path>', 'Output directory path')
    .option('--owner-site-id <siteId>', 'Owner site ID (required for deployment)')
    .option('--deploy', 'Deploy the applet after creation', false)
    .option('--scope <scope>', 'Applet scope (engagement or global)', 'engagement')
    .option('--author <author>', 'Author name')
    .option('--list-templates', 'List available templates')
    .action(async (options) => {
      try {
        // If just listing templates, do that and exit
        if (options.listTemplates) {
          await createApplet({ listTemplates: true });
          return;
        }
        
        // Check for required options or prompt for them
        let { name, template, output, ownerSiteId, deploy, scope, description, author } = options;
        
        if (!name) {
          name = await input({
            message: 'Enter applet name:',
            validate: (value) => value ? true : 'Applet name is required'
          });
        }
        
        if (!template) {
          const templates = await listAppletTemplates();
          if (templates.length === 0) {
            command.error('No applet templates available');
            return;
          }
          
          template = await select({
            message: 'Select a template:',
            choices: templates.map(t => ({
              name: `${t.displayName} - ${t.description}`,
              value: t.name
            }))
          });
        }
        
        if (!output) {
          const defaultOutput = path.resolve(process.cwd(), name.replace(/\s+/g, '-'));
          output = await input({
            message: 'Enter output directory path:',
            default: defaultOutput
          });
        }
        
        if (!description) {
          description = await input({
            message: 'Enter applet description (optional):',
            default: `A Glia applet created from template "${template}"`
          });
        }
        
        if (!author) {
          author = await input({
            message: 'Enter author name (optional):',
            default: ''
          });
        }
        
        if (!deploy) {
          deploy = await confirm({
            message: 'Deploy the applet after creation?',
            default: false
          });
        }
        
        if (deploy && !ownerSiteId) {
          ownerSiteId = await input({
            message: 'Enter owner site ID:',
            validate: (value) => value ? true : 'Owner site ID is required for deployment'
          });
        }
        
        if (deploy && !scope) {
          scope = await select({
            message: 'Select applet scope:',
            choices: [
              { name: 'Engagement - Available during engagements', value: 'engagement' },
              { name: 'Global - Available across the site', value: 'global' }
            ],
            default: 'engagement'
          });
        }
        
        // Create the applet
        const result = await createApplet({
          name,
          description,
          template,
          output,
          ownerSiteId,
          deploy,
          scope,
          author
        });
        
        // Display success message
        if (result.applet) {
          command.success(`Applet "${name}" created and deployed with ID: ${result.applet.id}`);
          command.log(`Output directory: ${result.outputDir}`);
        } else {
          command.success(`Applet "${name}" created successfully!`);
          command.log(`Output directory: ${result.outputDir}`);
          
          if (!deploy) {
            command.info('\nTo deploy this applet, run:');
            command.log(`glia-functions deploy-applet --path "${result.outputDir}/applet.html" --name "${name}" --owner-site-id <YOUR_SITE_ID>`);
          }
        }
      } catch (error) {
        command.error(`Failed to create applet: ${error.message}`);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default createApplet;