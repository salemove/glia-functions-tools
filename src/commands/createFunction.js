/**
 * Command to create a new function
 *
 * This command creates a new Glia Function with specified name and description.
 * It can also create a local function file using a template.
 */
import { getApiConfig } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';
import BaseCommand from '../cli/base-command.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// Use the unified template manager
import { createFunctionFromTemplate, getTemplateEnvVars, listTemplates } from '../utils/unified-template-manager.js';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a new function
 *
 * @param {Object} options - Command options
 * @param {string} options.name - Function name
 * @param {string} options.description - Function description
 * @param {string} [options.template] - Template to use for function
 * @param {string} [options.output] - Output path for function file
 * @param {boolean} [options.skipApi] - Skip API function creation
 * @param {number} [options.warmInstances] - Number of warm instances (0-5)
 * @returns {Promise<Object>} Created function details
 */
export async function createFunction(options) {
  try {
    let result = {};

    // Create function via API if not skipped
    if (!options.skipApi) {
      // Get API configuration
      const apiConfig = await getApiConfig();

      // Create API client
      const api = new GliaApiClient(apiConfig);

      // Create function
      console.log(`Creating new function "${options.name}"...`);
      const createOptions = {};
      if (options.warmInstances !== undefined) {
        createOptions.warmInstances = options.warmInstances;
      }
      const newFunction = await api.createFunction(options.name, options.description || '', createOptions);
      console.log('New function created:', newFunction);

      result = newFunction;
    }
    
    // Create function from template if specified
    if (options.template) {
      // Determine output path
      const outputPath = options.output || path.resolve(process.cwd(), `${options.name.replace(/\s+/g, '-')}.js`);
      
      console.log(`Creating function file from template "${options.template}"...`);
      
      // Create function file from template using the unified template manager
      await createFunctionFromTemplate(options.template, outputPath, {
        functionName: options.name
      });
      
      console.log(`Function file created at: ${outputPath}`);
      
      // Get recommended environment variables for this template
      const envVars = await getTemplateEnvVars(options.template);
      if (Object.keys(envVars).length > 0) {
        console.log('\nRecommended environment variables for this template:');
        for (const [key, value] of Object.entries(envVars)) {
          console.log(`- ${key}: ${value}`);
        }
      }
      
      result.filePath = outputPath;
      result.envVars = envVars;
    }
    
    return result;
  } catch (error) {
    console.error('Error creating function:', error);
    throw error;
  }
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('create-function', 'Create a new function')
    .requiredOption('--name <name>', 'Function name')
    .option('--description <description>', 'Function description', '')
    .option('--warm-instances <number>', 'Number of warm instances to keep running (0-5)', parseInt)
    .option('--template <template>', 'Template to use for function')
    .option('--output <path>', 'Output path for function file')
    .option('--list-templates', 'List available templates')
    .option('--skip-api', 'Skip creating function via API (local only)')
    .action(async (options) => {
      try {
        // List templates if requested
        if (options.listTemplates) {
          const templates = await listTemplates();
          console.log('\nAvailable function templates:');
          templates.forEach(template => {
            console.log(`- ${template.name}: ${template.description}`);
          });
          return;
        }

        // Create the function
        const result = await createFunction({
          name: options.name,
          description: options.description,
          warmInstances: options.warmInstances,
          template: options.template,
          output: options.output,
          skipApi: options.skipApi
        });
        
        // Display success message
        if (result.id) {
          if (result.filePath) {
            command.success(`Function "${options.name}" created with ID: ${result.id} and file at: ${result.filePath}`);
          } else {
            command.success(`Function "${options.name}" created with ID: ${result.id}`);
          }
        } else if (result.filePath) {
          command.success(`Function file created at: ${result.filePath}`);
        }
      } catch (error) {
        command.error(`Failed to create function: ${error.message}`);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default createFunction;
