/**
 * Templates command
 * 
 * This command provides a unified interface for managing templates
 * (functions, projects, applets), enabling operations like listing,
 * getting info, and creating from templates.
 */
import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import path from 'path';

import {
  listTemplates,
  getTemplate,
  createFromTemplate
} from '../utils/unified-template-manager.js';

/**
 * Main templates command handler
 * 
 * @param {Object} options - Command options
 * @param {Object} command - Command context
 * @returns {Promise<void>}
 */
export async function templatesCommand(options, command) {
  // List templates if list option or no subcommand
  if (options.list || (!options.create && !options.info)) {
    return await listTemplatesAction(options, command);
  }
  
  // Get info about a specific template
  if (options.info) {
    return await getTemplateInfoAction(options, command);
  }
  
  // Create from template
  if (options.create) {
    return await createFromTemplateAction(options, command);
  }
}

/**
 * List available templates
 * 
 * @param {Object} options - Command options
 * @param {Object} command - Command context
 * @returns {Promise<void>}
 */
async function listTemplatesAction(options, command) {
  try {
    // Get filter options
    const filters = {
      type: options.type,
      tag: options.tag,
      search: options.search
    };
    
    // Get templates
    const templates = await listTemplates(filters);
    
    if (templates.length === 0) {
      command.info('No templates found matching your criteria.');
      return;
    }
    
    // Display templates
    command.info(`Found ${templates.length} template(s):`);
    
    // Create table
    const table = new Table({
      head: ['Name', 'Type', 'Description', 'Version'],
      colWidths: [20, 12, 40, 10],
      style: { head: ['cyan'] }
    });
    
    // Add templates to table
    templates.forEach(template => {
      table.push([
        chalk.green(template.name),
        template.type,
        template.description || '',
        template.version || ''
      ]);
    });
    
    // Display table
    command.print(table.toString());
    
    // Show hint for more info
    command.info('For more information about a template, run:');
    command.info(chalk.yellow('glia templates --info <template-name>'));
    
  } catch (error) {
    command.error(`Error listing templates: ${error.message}`);
  }
}

/**
 * Get info about a specific template
 * 
 * @param {Object} options - Command options
 * @param {Object} command - Command context
 * @returns {Promise<void>}
 */
async function getTemplateInfoAction(options, command) {
  try {
    const templateName = options.info;
    
    // Get template
    const template = await getTemplate(templateName);
    
    // Display template info
    command.success(`Template: ${chalk.green(template.name)}`);
    command.print(`Display name: ${template.displayName || template.name}`);
    command.print(`Type: ${template.type}`);
    command.print(`Description: ${template.description || 'No description'}`);
    command.print(`Version: ${template.version || 'Not specified'}`);
    
    // Display variables
    if (template.variables && Object.keys(template.variables).length > 0) {
      command.print('\nVariables:');
      
      const varTable = new Table({
        head: ['Name', 'Description', 'Required', 'Default'],
        colWidths: [20, 30, 10, 20],
        style: { head: ['cyan'] }
      });
      
      Object.entries(template.variables).forEach(([name, config]) => {
        varTable.push([
          name,
          config.description || '',
          config.required ? chalk.yellow('Yes') : 'No',
          'default' in config ? config.default : ''
        ]);
      });
      
      command.print(varTable.toString());
    }
    
    // Display files (if any)
    if (template.files && template.files.length > 0) {
      command.print('\nFiles:');
      template.files.forEach(file => {
        command.print(`- ${file}`);
      });
    }
    
    // Display creation command
    command.info('\nTo create a project from this template, run:');
    command.info(chalk.yellow(`glia templates --create ${template.name} <output-dir>`));
    
  } catch (error) {
    command.error(`Error getting template info: ${error.message}`);
  }
}

/**
 * Create from template action
 * 
 * @param {Object} options - Command options
 * @param {Object} command - Command context
 * @returns {Promise<void>}
 */
async function createFromTemplateAction(options, command) {
  try {
    const templateName = options.create;
    const outputDir = options.output || process.cwd();
    
    // Get template
    const template = await getTemplate(templateName);
    
    // Collect variables
    const variables = await collectVariables(template, options, command);
    
    // Confirm creation
    command.info(`Creating from template ${chalk.green(template.name)} in ${chalk.cyan(outputDir)}...`);
    
    // Create from template
    const result = await createFromTemplate(templateName, outputDir, {
      variables,
      conditions: options.conditions || {}
    });
    
    // Display result
    command.success(`Successfully created ${result.files.length} file(s) from template ${chalk.green(template.name)}.`);
    
    // Display post-init actions (if any)
    if (result.postInit && result.postInit.length > 0) {
      command.info('\nPost-initialization actions:');
      
      result.postInit.forEach(action => {
        if (action.success) {
          command.info(`- ${chalk.green('✓')} ${action.action}`);
        } else {
          command.info(`- ${chalk.red('✗')} ${action.action}: ${action.error}`);
        }
      });
    }
    
    command.success(`\nTemplate ${chalk.green(template.name)} successfully applied to ${chalk.cyan(outputDir)}.`);
    
  } catch (error) {
    command.error(`Error creating from template: ${error.message}`);
  }
}

/**
 * Collect template variables from user
 * 
 * @param {Object} template - Template object
 * @param {Object} options - Command options
 * @param {Object} command - Command context
 * @returns {Promise<Object>} Collected variables
 */
async function collectVariables(template, options, command) {
  // Initialize with default values
  let variables = {};
  
  // Get default variables
  if (template.variables) {
    Object.entries(template.variables).forEach(([key, config]) => {
      if ('default' in config) {
        variables[key] = config.default;
      }
    });
  }
  
  // Override with provided variables
  if (options.variables) {
    try {
      // Parse variables string (format: key=value,key2=value2)
      const providedVars = options.variables.split(',').reduce((vars, pair) => {
        const [key, value] = pair.split('=');
        if (key && value) {
          vars[key.trim()] = value.trim();
        }
        return vars;
      }, {});
      
      variables = { ...variables, ...providedVars };
    } catch (error) {
      command.warn(`Error parsing variables: ${error.message}`);
      command.info('Using default variables instead.');
    }
  }
  
  // If not interactive and no variables provided, use defaults
  if (!options.interactive && !options.variables) {
    return variables;
  }
  
  // If interactive, prompt for required variables that are missing
  if (options.interactive && template.variables) {
    const questions = [];
    
    Object.entries(template.variables).forEach(([key, config]) => {
      // Only prompt for required variables that are missing
      if (config.required && (!variables[key] || variables[key].trim() === '')) {
        questions.push({
          type: 'input',
          name: key,
          message: config.description || `Enter value for ${key}:`,
          default: config.default || '',
          validate: (value) => {
            if (config.required && (!value || value.trim() === '')) {
              return `${key} is required`;
            }
            
            // Validate enum
            if (config.enum && !config.enum.includes(value)) {
              return `Value must be one of: ${config.enum.join(', ')}`;
            }
            
            return true;
          }
        });
      }
    });
    
    if (questions.length > 0) {
      command.info('Please provide values for the following variables:');
      const answers = await inquirer.prompt(questions);
      variables = { ...variables, ...answers };
    }
  }
  
  return variables;
}

/**
 * Command configuration
 */
export const command = {
  name: 'templates',
  alias: 't',
  description: 'Manage templates for functions, projects, and applets',
  options: [
    {
      name: 'list',
      alias: 'l',
      description: 'List available templates',
      type: Boolean
    },
    {
      name: 'info',
      alias: 'i',
      description: 'Get info about a specific template',
      type: String
    },
    {
      name: 'create',
      alias: 'c',
      description: 'Create from a template',
      type: String
    },
    {
      name: 'output',
      alias: 'o',
      description: 'Output directory for created files',
      type: String
    },
    {
      name: 'type',
      alias: 't',
      description: 'Filter templates by type (function, project, applet)',
      type: String
    },
    {
      name: 'tag',
      description: 'Filter templates by tag',
      type: String
    },
    {
      name: 'search',
      alias: 's',
      description: 'Search templates by name or description',
      type: String
    },
    {
      name: 'variables',
      alias: 'v',
      description: 'Template variables (format: key=value,key2=value2)',
      type: String
    },
    {
      name: 'interactive',
      alias: 'I',
      description: 'Interactive mode for variable input',
      type: Boolean,
      default: true
    }
  ],
  action: templatesCommand
};

export default command;