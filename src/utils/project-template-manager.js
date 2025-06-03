/**
 * Project Template Manager
 * 
 * This utility provides operations for managing project templates,
 * including listing available templates and creating projects from templates.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import * as childProcess from 'child_process';

// Convert callback-based fs functions to Promise-based
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readDirAsync = promisify(fs.readdir);
const mkdirAsync = promisify(fs.mkdir);
const statAsync = promisify(fs.stat);
const copyFileAsync = promisify(fs.copyFile);
const execAsync = promisify(childProcess.exec);

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to project templates directory
const projectTemplatesDir = path.resolve(__dirname, '../templates/projects');

/**
 * Get the list of available project templates
 * 
 * @returns {Promise<Object[]>} Array of template objects with metadata
 */
export async function listProjectTemplates() {
  try {
    // Read all directories in templates/projects directory
    const templateDirs = await readDirAsync(projectTemplatesDir);
    
    // Filter for directories that have template.json
    const templates = await Promise.all(templateDirs.map(async (dir) => {
      const dirPath = path.join(projectTemplatesDir, dir);
      const templateJsonPath = path.join(dirPath, 'template.json');
      
      // Skip if not a directory or doesn't have template.json
      try {
        const stats = await statAsync(dirPath);
        if (!stats.isDirectory()) return null;
        
        // Check if template.json exists
        const templateStats = await statAsync(templateJsonPath);
        if (!templateStats.isFile()) return null;
        
        // Read and parse template.json
        const content = await readFileAsync(templateJsonPath, 'utf8');
        const template = JSON.parse(content);
        
        return {
          name: template.name || dir,
          path: dirPath,
          displayName: template.displayName || template.name || dir,
          description: template.description || '',
          version: template.version || '1.0.0',
          variables: template.variables || {}
        };
      } catch (e) {
        return null;
      }
    }));
    
    // Filter out null results (not templates)
    return templates.filter(Boolean);
  } catch (error) {
    console.error('Error listing project templates:', error);
    throw new Error(`Failed to list project templates: ${error.message}`);
  }
}

/**
 * Get a specific project template by name
 * 
 * @param {string} templateName - Name of the template
 * @returns {Promise<Object>} Template object with metadata
 */
export async function getProjectTemplate(templateName) {
  try {
    const templates = await listProjectTemplates();
    const template = templates.find(t => t.name === templateName);
    
    if (!template) {
      throw new Error(`Project template "${templateName}" not found`);
    }
    
    // Read the template.json file for full details
    const templateJsonPath = path.join(template.path, 'template.json');
    const content = await readFileAsync(templateJsonPath, 'utf8');
    const templateData = JSON.parse(content);
    
    return {
      ...template,
      ...templateData
    };
  } catch (error) {
    console.error(`Error getting project template "${templateName}":`, error);
    throw new Error(`Failed to get project template: ${error.message}`);
  }
}

/**
 * Create a new project from a template
 * 
 * @param {string} templateName - Name of the template to use
 * @param {string} outputDir - Directory where the project will be created
 * @param {Object} variables - Values for template variables
 * @returns {Promise<Object>} Results of the project creation
 */
export async function createProjectFromTemplate(templateName, outputDir, variables = {}) {
  try {
    // Get template details
    const template = await getProjectTemplate(templateName);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      await mkdirAsync(outputDir, { recursive: true });
    }
    
    // Read all files in the template
    const filesToProcess = template.files || [];
    
    // If no files specified, use all files except template.json
    if (filesToProcess.length === 0) {
      const allFiles = await getAllFilesInDir(template.path);
      filesToProcess.push(...allFiles.filter(file => path.basename(file) !== 'template.json'));
    }
    
    // Process each file
    const processedFiles = await Promise.all(filesToProcess.map(async (filePath) => {
      // Resolve file path relative to template directory
      const sourcePath = path.join(template.path, filePath);
      const relativePath = filePath;
      const targetPath = path.join(outputDir, relativePath);
      
      // Create directory if it doesn't exist
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        await mkdirAsync(targetDir, { recursive: true });
      }
      
      // Read the source file
      try {
        const content = await readFileAsync(sourcePath, 'utf8');
        
        // Replace variables in content
        const processedContent = replaceVariables(content, variables);
        
        // Write to target file
        await writeFileAsync(targetPath, processedContent, 'utf8');
        
        return {
          file: relativePath,
          success: true
        };
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        return {
          file: relativePath,
          success: false,
          error: error.message
        };
      }
    }));
    
    // Run post-initialization actions
    const postInitResults = [];
    if (template.postInit && Array.isArray(template.postInit)) {
      for (const action of template.postInit) {
        // Handle special actions
        if (action.startsWith('Copy ') && action.includes(' to ')) {
          const [_, sourcePath, targetPath] = action.match(/Copy (.*) to (.*)/);
          if (sourcePath && targetPath) {
            try {
              const sourceFile = path.join(outputDir, sourcePath);
              const targetFile = path.join(outputDir, targetPath);
              
              if (fs.existsSync(sourceFile)) {
                await copyFileAsync(sourceFile, targetFile);
                postInitResults.push({ action, success: true });
              } else {
                postInitResults.push({ 
                  action, 
                  success: false, 
                  error: `Source file ${sourcePath} not found` 
                });
              }
            } catch (error) {
              postInitResults.push({ 
                action, 
                success: false, 
                error: error.message 
              });
            }
          }
        } else if (action.startsWith('Install dependencies:')) {
          const command = action.replace('Install dependencies:', '').trim();
          try {
            await execAsync(command, { cwd: outputDir });
            postInitResults.push({ action, success: true });
          } catch (error) {
            postInitResults.push({ 
              action, 
              success: false, 
              error: error.message 
            });
          }
        } else {
          // Other actions are just logged
          postInitResults.push({ action, success: true });
        }
      }
    }
    
    // Install dev dependencies specified in template
    if (template.devDependencies && Array.isArray(template.devDependencies) && template.devDependencies.length > 0) {
      try {
        const dependencies = template.devDependencies.join(' ');
        await execAsync(`npm install --save-dev ${dependencies}`, { cwd: outputDir });
        postInitResults.push({ 
          action: `Install dev dependencies: ${dependencies}`, 
          success: true 
        });
      } catch (error) {
        postInitResults.push({ 
          action: `Install dev dependencies`, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return {
      template: template.name,
      outputDir,
      files: processedFiles,
      postInit: postInitResults
    };
  } catch (error) {
    console.error(`Error creating project from template "${templateName}":`, error);
    throw new Error(`Failed to create project from template: ${error.message}`);
  }
}

/**
 * Replace template variables in a string
 * 
 * @param {string} content - Content with variables to replace
 * @param {Object} variables - Values for template variables
 * @returns {string} Content with variables replaced
 */
function replaceVariables(content, variables) {
  let result = content;
  
  // Replace all occurrences of {{variableName}} with the variable value
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  });
  
  return result;
}

/**
 * Get all files in a directory recursively
 * 
 * @param {string} dir - Directory to scan
 * @param {string} baseDir - Base directory for relative paths
 * @returns {Promise<string[]>} Array of file paths relative to baseDir
 */
async function getAllFilesInDir(dir, baseDir = undefined) {
  const baseDirToUse = baseDir || dir;
  const result = [];
  
  async function scanDir(currentDir) {
    const entries = await readDirAsync(currentDir);
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stats = await statAsync(fullPath);
      
      if (stats.isFile()) {
        result.push(path.relative(baseDirToUse, fullPath));
      } else if (stats.isDirectory()) {
        await scanDir(fullPath);
      }
    }
  }
  
  await scanDir(dir);
  return result;
}

/**
 * Validate template variables
 * 
 * @param {Object} template - Template object
 * @param {Object} variables - Variable values to validate
 * @returns {Object} Validation result with errors if any
 */
export function validateTemplateVariables(template, variables) {
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
    });
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Get default variable values for a template
 * 
 * @param {Object} template - Template object
 * @returns {Object} Default variable values
 */
export function getTemplateDefaultVars(template) {
  const defaults = {};
  
  // Extract default values from template variables
  if (template.variables) {
    Object.entries(template.variables).forEach(([key, config]) => {
      if ('default' in config) {
        defaults[key] = config.default;
      }
    });
  }
  
  return defaults;
}

export default {
  listProjectTemplates,
  getProjectTemplate,
  createProjectFromTemplate,
  validateTemplateVariables,
  getTemplateDefaultVars
};