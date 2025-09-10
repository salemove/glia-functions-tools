/**
 * Applet Template Manager Utility
 * 
 * This utility provides operations for managing applet templates,
 * including listing available templates, getting template details,
 * and creating applets from templates.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

// Convert callback-based fs functions to Promise-based
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readDirAsync = promisify(fs.readdir);
const mkdirAsync = promisify(fs.mkdir);
const statAsync = promisify(fs.stat);
const copyFileAsync = promisify(fs.copyFile);

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to applet templates directory
const appletTemplatesDir = path.resolve(__dirname, '../templates/applets');

/**
 * List available applet templates
 * 
 * @returns {Promise<Array>} Array of template objects with name and metadata
 */
export async function listAppletTemplates() {
  try {
    // Check if templates directory exists
    if (!fs.existsSync(appletTemplatesDir)) {
      return [];
    }

    // Read template directories
    const templateDirs = await readDirAsync(appletTemplatesDir);
    
    // Read metadata from each template
    const templates = await Promise.all(templateDirs.map(async (dir) => {
      const templateDir = path.join(appletTemplatesDir, dir);
      const stats = await statAsync(templateDir);
      
      // Skip if not a directory
      if (!stats.isDirectory()) {
        return null;
      }
      
      const metadataPath = path.join(templateDir, 'template.json');
      
      // Skip if no metadata file
      if (!fs.existsSync(metadataPath)) {
        return null;
      }
      
      try {
        const metadata = JSON.parse(await readFileAsync(metadataPath, 'utf8'));
        return {
          name: dir,
          displayName: metadata.displayName || dir,
          description: metadata.description || 'Glia Applet Template',
          variables: metadata.variables || {}
        };
      } catch (error) {
        console.error(`Error reading metadata for template ${dir}:`, error);
        return null;
      }
    }));
    
    // Filter out null values (directories without metadata or non-directories)
    return templates.filter(Boolean);
  } catch (error) {
    console.error('Error listing applet templates:', error);
    throw new Error(`Failed to list applet templates: ${error.message}`);
  }
}

/**
 * Get a specific applet template by name
 * 
 * @param {string} templateName - Name of the template
 * @returns {Promise<Object>} Template object with metadata and files
 */
export async function getAppletTemplate(templateName) {
  try {
    const templateDir = path.join(appletTemplatesDir, templateName);
    
    // Check if template exists
    if (!fs.existsSync(templateDir)) {
      throw new Error(`Applet template "${templateName}" not found`);
    }
    
    // Read template metadata
    const metadataPath = path.join(templateDir, 'template.json');
    if (!fs.existsSync(metadataPath)) {
      throw new Error(`Invalid applet template: Missing metadata file`);
    }
    
    const metadata = JSON.parse(await readFileAsync(metadataPath, 'utf8'));
    
    // Return template info
    return {
      name: templateName,
      metadata
    };
  } catch (error) {
    console.error(`Error getting applet template "${templateName}":`, error);
    throw new Error(`Failed to get applet template: ${error.message}`);
  }
}

/**
 * Create an applet from a template
 * 
 * @param {string} templateName - Name of the template
 * @param {string} outputDir - Output directory path
 * @param {Object} variables - Template variables
 * @returns {Promise<Object>} Result object with paths to created files
 */
export async function createAppletFromTemplate(templateName, outputDir, variables = {}) {
  try {
    // Get the template
    const template = await getAppletTemplate(templateName);
    const { metadata } = template;
    
    if (!metadata.files || !Array.isArray(metadata.files) || metadata.files.length === 0) {
      throw new Error('Template has no files defined');
    }
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      await mkdirAsync(outputDir, { recursive: true });
    }
    
    // Get template directory path
    const templateDir = path.join(appletTemplatesDir, templateName);
    
    // Process each file
    const createdFiles = await Promise.all(metadata.files.map(async (file) => {
      // Get source and destination paths
      const sourcePath = path.join(templateDir, file.source);
      const destPath = path.join(outputDir, file.destination);
      
      // Create destination directory if needed
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        await mkdirAsync(destDir, { recursive: true });
      }
      
      // Read the source file
      const content = await readFileAsync(sourcePath, 'utf8');
      
      // If this is a template file, replace variables
      let processedContent = content;
      
      if (file.template) {
        // Simple variable replacement with {{varName}}
        processedContent = content.replace(/{{([^{}]+)}}/g, (match, varName) => {
          return variables[varName] !== undefined ? variables[varName] : match;
        });
        
        // Conditional sections with {{#if varName}}...{{/if}}
        processedContent = processedContent.replace(/{{#if ([^{}]+)}}([\s\S]*?){{\/if}}/g, (match, varName, content) => {
          return variables[varName] ? content : '';
        });
      }
      
      // Write the file
      await writeFileAsync(destPath, processedContent, 'utf8');
      
      return destPath;
    }));
    
    return {
      template: templateName,
      outputDir,
      files: createdFiles
    };
  } catch (error) {
    console.error(`Error creating applet from template "${templateName}":`, error);
    throw new Error(`Failed to create applet from template: ${error.message}`);
  }
}

/**
 * Get recommended environment variables for an applet template
 * 
 * @param {string} templateName - Name of the template
 * @returns {Promise<Object>} Object containing recommended environment variables
 */
export async function getAppletTemplateEnvVars(templateName) {
  try {
    // Get the template metadata
    const templateDir = path.join(appletTemplatesDir, templateName);
    const metadataPath = path.join(templateDir, 'template.json');
    
    if (!fs.existsSync(metadataPath)) {
      return {};
    }
    
    const metadata = JSON.parse(await readFileAsync(metadataPath, 'utf8'));
    
    // Extract environment variables
    return metadata.environmentVariables || {};
  } catch (error) {
    console.error(`Error getting applet template env vars for "${templateName}":`, error);
    return {};
  }
}

/**
 * Validate template variables
 * 
 * @param {string} templateName - Name of the template 
 * @param {Object} variables - Variables to validate
 * @returns {Promise<Object>} Object with validation results
 */
export async function validateTemplateVariables(templateName, variables = {}) {
  try {
    // Get the template metadata
    const template = await getAppletTemplate(templateName);
    const { metadata } = template;
    
    // If no variables defined in template, return valid
    if (!metadata.variables) {
      return { isValid: true };
    }
    
    // Check required variables
    const missing = [];
    
    for (const [varName, varConfig] of Object.entries(metadata.variables)) {
      if (varConfig.required && variables[varName] === undefined) {
        missing.push(varName);
      }
    }
    
    if (missing.length > 0) {
      return {
        isValid: false,
        missing,
        message: `Missing required variables: ${missing.join(', ')}`
      };
    }
    
    return { isValid: true };
  } catch (error) {
    console.error(`Error validating template variables for "${templateName}":`, error);
    throw new Error(`Failed to validate template variables: ${error.message}`);
  }
}

export default {
  listAppletTemplates,
  getAppletTemplate,
  createAppletFromTemplate,
  getAppletTemplateEnvVars,
  validateTemplateVariables
};