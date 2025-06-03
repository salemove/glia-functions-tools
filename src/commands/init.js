/**
 * Command to initialize a new function project
 *
 * This command creates a new project from a template
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
  listProjectTemplates, 
  getProjectTemplate, 
  createProjectFromTemplate,
  validateTemplateVariables,
  getTemplateDefaultVars
} from '../utils/project-template-manager.js';
import BaseCommand from '../cli/base-command.js';

/**
 * Initialize a new project from template
 * 
 * @param {Object} options - Command options
 * @param {string} options.template - Template name to use
 * @param {string} options.output - Output directory
 * @param {Object} options.variables - Template variables
 * @returns {Promise<Object>} Results of initialization
 */
export async function initCommand(options) {
  try {
    // Handle list templates option
    if (options.listTemplates) {
      console.log('Fetching available project templates...');
      const templates = await listProjectTemplates();
      
      if (templates.length === 0) {
        console.log('No project templates available');
      } else {
        console.log('\nAvailable project templates:');
        templates.forEach(template => {
          console.log(`- ${template.displayName}: ${template.description}`);
        });
      }
      
      return { templates };
    }
    
    // Validate required options
    if (!options.template) {
      throw new Error('Template name is required (use --template)');
    }
    
    // Check if template exists
    const template = await getProjectTemplate(options.template);
    
    // Determine output directory
    const outputDir = options.output || path.resolve(process.cwd(), template.name);
    
    // Check if output directory exists and is not empty
    if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).length > 0) {
      if (!options.force) {
        throw new Error(`Output directory "${outputDir}" already exists and is not empty. Use --force to overwrite.`);
      } else {
        console.log(`Warning: Output directory "${outputDir}" already exists. Files may be overwritten.`);
      }
    }
    
    // Get default variables
    const defaultVars = getTemplateDefaultVars(template);
    
    // Merge with provided variables
    const variables = { ...defaultVars, ...options.variables };
    
    // Validate variables
    const validation = validateTemplateVariables(template, variables);
    if (!validation.valid) {
      throw new Error(`Invalid template variables: ${validation.errors.join(', ')}`);
    }
    
    // Create project from template
    console.log(`Creating project from template "${template.displayName}"...`);
    const result = await createProjectFromTemplate(template.name, outputDir, variables);
    
    // Print results
    console.log(`\nProject created successfully in ${outputDir}`);
    console.log(`\nFiles created: ${result.files.filter(f => f.success).length}`);
    
    if (result.files.some(f => !f.success)) {
      console.log(`\nErrors: ${result.files.filter(f => !f.success).length}`);
      result.files.filter(f => !f.success).forEach(f => {
        console.log(`- ${f.file}: ${f.error}`);
      });
    }
    
    // Print post-init results
    if (result.postInit && result.postInit.length > 0) {
      console.log('\nPost-initialization actions:');
      result.postInit.forEach(action => {
        if (action.success) {
          console.log(`- ✅ ${action.action}`);
        } else {
          console.log(`- ❌ ${action.action}: ${action.error}`);
        }
      });
    }
    
    // Print next steps
    console.log('\nNext steps:');
    console.log(`1. cd ${path.relative(process.cwd(), outputDir)}`);
    console.log('2. Review and edit the generated files');
    console.log('3. Run "npm install" if dependencies are not already installed');
    console.log('4. Follow the instructions in README.md');
    
    return result;
    
  } catch (error) {
    throw error;
  }
}

/**
 * Parse variables from a string
 * 
 * @param {string} str - Variables string (key1=value1,key2=value2)
 * @returns {Object} Parsed variables
 */
function parseVariables(str) {
  if (!str) return {};
  
  return str.split(',').reduce((vars, item) => {
    const [key, value] = item.split('=');
    if (key && value) {
      vars[key.trim()] = value.trim();
    }
    return vars;
  }, {});
}

/**
 * Command handler when run directly from CLI
 */
async function main() {
  const command = new BaseCommand('init', 'Initialize a new function project from template')
    .option('--template <template>', 'Template to use')
    .option('--output <path>', 'Output directory')
    .option('--variables <vars>', 'Template variables (key1=value1,key2=value2)', parseVariables)
    .option('--list-templates', 'List available templates')
    .option('--force', 'Force create even if directory exists', false)
    .action(async (options) => {
      try {
        await initCommand(options);
        command.success('Project initialization completed successfully');
      } catch (error) {
        command.error(`Failed to initialize project: ${error.message}`);
      }
    });
    
  command.parse(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default initCommand;