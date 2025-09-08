/**
 * Template selection utility for CLI
 * 
 * This module provides functions for interactive template selection
 * and management in the CLI, using the unified template manager.
 */
import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// Import the unified template manager and engine
import { 
  listTemplates,
  getTemplate,
  getTemplateDefaultVars,
  createFromTemplate,
  validateTemplateVariables
} from '../utils/unified-template-manager.js';

/**
 * Select a template interactively
 * 
 * @param {Object} options - Options for template selection
 * @param {string|string[]} options.type - Template type(s) to filter by
 * @param {string} options.message - Prompt message
 * @param {boolean} options.showDescription - Whether to show descriptions in the selection menu
 * @param {Function} options.filter - Optional filter function for templates
 * @param {boolean} options.groupByCategory - Whether to group templates by category/tags
 * @returns {Promise<Object>} Selected template object
 */
export async function selectTemplate(options = {}) {
  const { 
    type = null, 
    message = 'Select a template:',
    showDescription = true,
    filter = null,
    groupByCategory = true
  } = options;
  
  // Get templates filtered by type
  const templates = await listTemplates({ type });
  
  // Apply additional filter if provided
  const filteredTemplates = filter ? templates.filter(filter) : templates;
  
  if (filteredTemplates.length === 0) {
    throw new Error('No templates found matching the criteria');
  }
  
  let templateChoices = [];
  
  // Group by category if requested
  if (groupByCategory) {
    // Create categories based on tags or template type
    const categories = {};
    
    // Process each template
    filteredTemplates.forEach(template => {
      // Use primary tag or template type as category
      const primaryTag = template.tags?.[0] || template.type || 'other';
      
      // Initialize category if needed
      if (!categories[primaryTag]) {
        categories[primaryTag] = [];
      }
      
      // Add template to category
      categories[primaryTag].push(template);
    });
    
    // Create separator and choices for each category
    Object.entries(categories).forEach(([category, categoryTemplates]) => {
      // Only add separator if we already have choices
      if (templateChoices.length > 0) {
        templateChoices.push({ 
          name: `--- ${category.toUpperCase()} TEMPLATES ---`, 
          value: `separator_${category}`,
          disabled: true 
        });
      }
      
      // Add templates in this category
      categoryTemplates.forEach(template => {
        templateChoices.push({
          name: showDescription 
            ? `${template.displayName || template.name}: ${template.description || ''}`
            : template.displayName || template.name,
          value: template.name,
          description: showDescription ? undefined : template.description
        });
      });
    });
  } else {
    // No grouping - create flat list
    templateChoices = filteredTemplates.map(template => ({
      name: showDescription 
        ? `${template.displayName || template.name}: ${template.description || ''}`
        : template.displayName || template.name,
      value: template.name,
      description: showDescription ? undefined : template.description
    }));
  }
  
  // Add back option
  templateChoices.push({
    name: '(Back)',
    value: 'back'
  });
  
  // Select template
  const selectedTemplateName = await select({
    message,
    choices: templateChoices
  });
  
  if (selectedTemplateName === 'back' || selectedTemplateName.startsWith('separator_')) {
    return { canceled: true };
  }
  
  // Get selected template with inheritance resolved
  const { getTemplate } = await import('../utils/unified-template-manager.js');
  return getTemplate(selectedTemplateName, null, true);
}

/**
 * Collect template variables interactively
 * 
 * @param {Object} template - Template object
 * @param {Object} initialVars - Initial variable values
 * @param {Object} options - Options for variable collection
 * @param {boolean} options.onlyRequired - Only collect required variables
 * @returns {Promise<Object>} Collected variables
 */
export async function collectTemplateVariables(template, initialVars = {}, options = {}) {
  const { onlyRequired = false } = options;
  
  // Get default variables
  const defaultVars = getTemplateDefaultVars(template);
  
  // Start with defaults + any provided initial values
  const variables = { ...defaultVars, ...initialVars };
  
  // If the template doesn't have variables, return the defaults
  if (!template.variables || Object.keys(template.variables).length === 0) {
    return variables;
  }
  
  console.log(chalk.blue('\nTemplate variables:'));
  
  // Collect variables
  for (const [key, config] of Object.entries(template.variables)) {
    // Skip non-required variables if onlyRequired is true
    if (onlyRequired && !config.required) {
      continue;
    }
    
    // Skip if already provided in initialVars
    if (initialVars[key] !== undefined) {
      console.log(`- ${key}: ${initialVars[key]} (provided)`);
      continue;
    }
    
    const defaultValue = config.default || '';
    let message = config.description || key;
    if (config.required) {
      message += ' (required)';
    }
    
    const value = await input({
      message,
      default: defaultValue,
      validate: (input) => {
        if (config.required && !input) {
          return `${key} is required`;
        }
        return true;
      }
    });
    
    variables[key] = value;
  }
  
  return variables;
}

/**
 * Create from selected template
 * 
 * @param {Object} options - Options for template creation
 * @param {Object} options.template - Template object
 * @param {string} options.outputDir - Output directory
 * @param {Object} options.variables - Template variables
 * @returns {Promise<Object>} Result of template creation
 */
export async function createFromSelectedTemplate(options = {}) {
  const { template, outputDir, variables = {} } = options;
  
  // Validate required options
  if (!template || !outputDir) {
    throw new Error('Template and output directory are required');
  }
  
  // Validate template variables
  const validation = validateTemplateVariables(template, variables);
  if (!validation.valid) {
    throw new Error(`Invalid template variables: ${validation.errors.join(', ')}`);
  }
  
  // Check if directory exists and is not empty
  if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).length > 0) {
    const overwrite = await confirm({
      message: `Directory "${outputDir}" already exists and is not empty. Proceed anyway?`,
      default: false
    });
    
    if (!overwrite) {
      return { canceled: true };
    }
  }
  
  // Create from template
  console.log(chalk.blue(`Creating from template "${template.displayName}"...`));
  
  const result = await createFromTemplate(template.name, outputDir, {
    variables,
    type: template.type
  });
  
  // Display info about generated manifest
  if (result.manifest) {
    console.log(chalk.green(`\nProject manifest created: ${path.basename(result.manifest.path)}`));
    console.log(chalk.blue('Component summary:'));
    const componentCounts = {
      functions: result.manifest.content.components?.functions?.length || 0,
      applets: result.manifest.content.components?.applets?.length || 0,
      kvNamespaces: result.manifest.content.kvStore?.namespaces?.length || 0,
      linkages: result.manifest.content.linkages?.length || 0
    };
    
    Object.entries(componentCounts).forEach(([type, count]) => {
      console.log(`  ${chalk.yellow(type.padEnd(12))}: ${count}`);
    });
    
    // If we have linkages, show them
    if (componentCounts.linkages > 0) {
      console.log(chalk.blue('\nLinkages:'));
      result.manifest.content.linkages.forEach((linkage, index) => {
        console.log(`  ${chalk.yellow((index + 1) + '.')} ${linkage.from} → ${linkage.to}`);
      });
    }
    
    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. cd ${outputDir}`);
    console.log('  2. Review the generated project manifest (glia-project.json)');
    console.log('  3. Deploy your project with: glia-functions deploy-project');
  }
  
  return result;
}

export default {
  selectTemplate,
  collectTemplateVariables,
  createFromSelectedTemplate
};