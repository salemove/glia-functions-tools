/**
 * Template Engine Utility
 * 
 * This utility provides template processing capabilities for the template system,
 * including variable substitution, conditional sections, and validation.
 */
import * as Handlebars from 'handlebars';

/**
 * Process a template with variables using simple substitution
 * 
 * @param {string} content - Template content
 * @param {Object} variables - Values for template variables
 * @returns {string} Processed content
 */
export function processSimpleTemplate(content, variables = {}) {
  let result = content;
  
  // Replace all occurrences of {{variableName}} with the variable value
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  });
  
  return result;
}

/**
 * Process a template with Handlebars for more advanced templating features
 * 
 * @param {string} content - Template content
 * @param {Object} variables - Values for template variables
 * @returns {string} Processed content
 */
export function processHandlebarsTemplate(content, variables = {}) {
  try {
    // Compile the template
    const template = Handlebars.compile(content);
    
    // Execute the template with the provided variables
    return template(variables);
  } catch (error) {
    console.error('Error processing template with Handlebars:', error);
    throw new Error(`Failed to process template: ${error.message}`);
  }
}

/**
 * Process conditional sections in a template
 * Format: {{#if condition}}content{{/if}}
 * 
 * @param {string} content - Template content
 * @param {Object} conditions - Condition values
 * @returns {string} Processed content
 */
export function processConditionalSections(content, conditions = {}) {
  let result = content;
  
  // Process each condition
  Object.entries(conditions).forEach(([key, value]) => {
    // If condition is true, keep content between tags
    if (value) {
      const regex = new RegExp(`{{#if ${key}}}([\\s\\S]*?){{/if}}`, 'g');
      result = result.replace(regex, '$1');
    } else {
      // If condition is false, remove content between tags
      const regex = new RegExp(`{{#if ${key}}}[\\s\\S]*?{{/if}}`, 'g');
      result = result.replace(regex, '');
    }
  });
  
  // Process nested conditionals
  // Iteratively remove remaining conditional tags to handle nested conditions
  let previousResult;
  do {
    previousResult = result;
    // Remove any remaining conditional tags
    result = result.replace(/{{#if [\w.]+}}[\s\S]*?{{\/if}}/g, '');
  } while (result !== previousResult);
  
  return result;
}

/**
 * Main template processing function that chooses the appropriate engine
 * 
 * @param {string} content - Template content
 * @param {Object} variables - Values for template variables
 * @param {string} engine - Template engine to use ('simple' or 'handlebars')
 * @returns {string} Processed content
 */
export function processTemplate(content, variables = {}, engine = 'simple') {
  switch (engine) {
    case 'handlebars':
      return processHandlebarsTemplate(content, variables);
    case 'simple':
    default:
      return processSimpleTemplate(content, variables);
  }
}

/**
 * Validate template variables against a schema
 * 
 * @param {Object} template - Template object with variables schema
 * @param {Object} variables - Variable values to validate
 * @returns {Object} Validation result with errors if any
 */
export function validateTemplateVariables(template, variables = {}) {
  const errors = [];
  
  // Check for required variables
  if (template.variables) {
    Object.entries(template.variables).forEach(([key, config]) => {
      if (config.required && (!variables[key] || variables[key].trim() === '')) {
        errors.push(`Missing required variable: ${key}`);
      }
      
      // Check enum values
      if (config.enum && variables[key] && !config.enum.includes(variables[key])) {
        errors.push(`Invalid value for ${key}. Must be one of: ${config.enum.join(', ')}`);
      }
      
      // Check type constraints
      if (config.type && variables[key]) {
        switch (config.type) {
          case 'number':
            if (isNaN(Number(variables[key]))) {
              errors.push(`Invalid type for ${key}. Expected number.`);
            }
            break;
          case 'boolean':
            if (typeof variables[key] !== 'boolean' && 
                !['true', 'false'].includes(String(variables[key]).toLowerCase())) {
              errors.push(`Invalid type for ${key}. Expected boolean.`);
            }
            break;
        }
      }
    });
  }
  
  return { valid: errors.length === 0, errors };
}

export default {
  processTemplate,
  processSimpleTemplate,
  processHandlebarsTemplate,
  processConditionalSections,
  validateTemplateVariables
};