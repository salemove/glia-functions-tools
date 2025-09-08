/**
 * Unified Template Manager
 * 
 * This utility provides a unified interface for managing templates of all types
 * (functions, projects, applets) using the template registry system.
 * It also supports project manifests for multi-component deployments.
 */
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import * as childProcess from 'child_process';

// Import template utilities
import { 
  readTemplateRegistry, 
  getTemplateByName, 
  listTemplates as listRegistryTemplates
} from './template-registry.js';

// Import package.json template manager
import packageTemplateManager from './package-template-manager.js';

// Import project manifest utilities
import { processProjectManifest } from './project-manifest-processor.js';

import {
  processTemplate,
  processConditionalSections,
  validateTemplateVariables,
} from './template-engine.js';

// Convert callback-based fs functions to Promise-based
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const copyFileAsync = promisify(fs.copyFile);
const execAsync = promisify(childProcess.exec);

/**
 * List all available templates, optionally filtered by type
 * 
 * @param {Object} options - Filter options
 * @param {string} options.type - Filter by template type
 * @param {string} options.tag - Filter by template tag
 * @param {string} options.search - Search term to filter by
 * @returns {Promise<Object[]>} Array of template objects
 */
export async function listTemplates(options = {}) {
  return listRegistryTemplates(options);
}

/**
 * Get a specific template by name
 * 
 * @param {string} templateName - Name of the template
 * @param {string} templateType - Optional type of template to filter by
 * @param {boolean} resolveInheritance - Whether to resolve template inheritance
 * @returns {Promise<Object>} Template object
 */
export async function getTemplate(templateName, templateType = null, resolveInheritance = true) {
  const template = await getTemplateByName(templateName, false, resolveInheritance);
  
  if (!template) {
    throw new Error(`Template "${templateName}" not found`);
  }
  
  if (templateType && template.type !== templateType) {
    throw new Error(`Template "${templateName}" is not a ${templateType} template`);
  }
  
  return template;
}

/**
 * Get default variables for a template
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

/**
 * Process a template file
 * 
 * @param {string} sourcePath - Path to source file
 * @param {string} targetPath - Path to target file
 * @param {Object} variables - Values for template variables
 * @param {Object} conditions - Values for template conditions
 * @param {string} engine - Template engine to use
 * @returns {Promise<Object>} Result of file processing
 */
export async function processTemplateFile(sourcePath, targetPath, variables = {}, conditions = {}, engine = 'simple') {
  try {
    // Read the source file
    const content = await readFileAsync(sourcePath, 'utf8');
    
    // Process conditions and variables
    let processedContent = processConditionalSections(content, conditions);
    processedContent = processTemplate(processedContent, variables, engine);
    
    // Create directory if it doesn't exist
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      await mkdirAsync(targetDir, { recursive: true });
    }
    
    // Write to target file
    await writeFileAsync(targetPath, processedContent, 'utf8');
    
    return {
      source: sourcePath,
      target: targetPath,
      success: true
    };
  } catch (error) {
    console.error(`Error processing template file ${sourcePath}:`, error);
    return {
      source: sourcePath,
      target: targetPath,
      success: false,
      error: error.message
    };
  }
}

/**
 * Process template files according to inheritance and conditions
 * 
 * @param {Object} template - Template object with resolved inheritance
 * @param {string} outputDir - Directory where files will be created
 * @param {Object} options - Options for template processing
 * @returns {Promise<Array<Object>>} Results of file processing
 */
export async function processTemplateFiles(template, outputDir, options = {}) {
  // Apply package.json template handling
  template = await packageTemplateManager.applyPackageJsonTemplate(template, options.variables || {});
  // Get the base set of files to process
  let filesToProcess = [];
  
  // Start with explicit files list if available
  if (template.files && Array.isArray(template.files)) {
    filesToProcess = [...template.files];
  } else {
    // Fall back to scanning the template directory
    const templateFiles = await getAllFilesInDir(template.path);
    filesToProcess = templateFiles.filter(file => path.basename(file) !== 'template.json');
  }
  
  // Add conditional files based on conditions
  const conditions = options.conditions || {};
  if (template.conditionalFiles) {
    Object.entries(template.conditionalFiles).forEach(([condition, files]) => {
      if (conditions[condition]) {
        filesToProcess.push(...files);
      }
    });
  }
  
  // Process exclusions (files prefixed with !)
  const exclusions = filesToProcess
    .filter(file => typeof file === 'string' && file.startsWith('!'))
    .map(file => file.substring(1));
    
  const finalFiles = filesToProcess
    .filter(file => typeof file === 'string' ? !file.startsWith('!') : true)
    .filter(file => typeof file === 'string' ? !exclusions.includes(file) : true);
  
  // Process each file
  return Promise.all(finalFiles.map(async (fileItem) => {
    // Handle both string paths and file objects
    let sourceFile, destFile;
    let isTemplateFile = true;
    
    if (typeof fileItem === 'string') {
      sourceFile = fileItem;
      destFile = fileItem;
    } else if (typeof fileItem === 'object' && fileItem !== null) {
      sourceFile = fileItem.source || fileItem.path || '';
      destFile = fileItem.destination || fileItem.target || fileItem.source || fileItem.path || '';
      isTemplateFile = fileItem.template !== false; // Default to true if not specified
    } else {
      return {
        source: String(fileItem),
        target: path.join(outputDir, String(fileItem)),
        success: false,
        error: `Invalid file specification`
      };
    }
    
    // Check if this is a package.json file with template marker
    if (fileItem._packageTemplate || sourceFile === 'package.json') {
      return await packageTemplateManager.processPackageJsonFile(fileItem, template, outputDir, options.variables || {});
    }
    
    // Determine source path - consider inheritance chain
    let sourcePath = null;
    let sourceTemplate = null;
    
    // Start with the current template
    if (fs.existsSync(path.join(template.path, sourceFile))) {
      sourcePath = path.join(template.path, sourceFile);
      sourceTemplate = template;
    } 
    // If file not found in current template, check parent templates
    else if (template._resolvedFrom) {
      // Check each parent template in the chain
      for (const parentName of template._resolvedFrom) {
        const parentTemplate = await getTemplateByName(parentName, false, false);
        if (parentTemplate && fs.existsSync(path.join(parentTemplate.path, sourceFile))) {
          sourcePath = path.join(parentTemplate.path, sourceFile);
          sourceTemplate = parentTemplate;
          break;
        }
      }
    }
    
    if (!sourcePath) {
      return {
        source: sourceFile,
        target: path.join(outputDir, destFile),
        success: false,
        error: `Source file not found in template chain`
      };
    }
    
    // Determine target path
    const relativePath = processTemplate(destFile, options.variables || {});
    const targetPath = path.join(outputDir, relativePath);
    
    // Process the file
    return processTemplateFile(
      sourcePath,
      targetPath,
      options.variables || {},
      conditions,
      sourceTemplate.engine || options.engine || 'simple'
    );
  }));
}

/**
 * Create from template - unified method for all template types
 * 
 * @param {string} templateName - Name of the template to use
 * @param {string} outputDir - Directory where files will be created
 * @param {Object} options - Options for template processing
 * @returns {Promise<Object>} Results of template creation
 */
export async function createFromTemplate(templateName, outputDir, options = {}) {
  try {
    // Get the template with inheritance resolved
    const template = await getTemplate(templateName, options.type, true);
    
    // Prepare variables
    const defaultVars = getTemplateDefaultVars(template);
    const variables = { ...defaultVars, ...options.variables };
    
    // Prepare conditions (if any)
    const conditions = options.conditions || {};
    
    // Update options with processed variables
    const processedOptions = {
      ...options,
      variables,
      conditions
    };
    
    // Validate variables
    const validation = validateTemplateVariables(template, variables);
    if (!validation.valid) {
      throw new Error(`Invalid template variables: ${validation.errors.join(', ')}`);
    }
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      await mkdirAsync(outputDir, { recursive: true });
    }
    
    // Process template files using the enhanced file processor
    const processedFiles = await processTemplateFiles(template, outputDir, processedOptions);
    
    // Generate project manifest if this is a project template or an applet with projectType
    let manifestResult = null;
    if (template.type === 'project' || template.projectManifest || template.projectType) {
      try {
        // Process project manifest
        const manifest = await processProjectManifest(template, variables, outputDir, {
          autoDiscover: options.autoDiscover !== false,
          validateManifest: options.validateManifest !== false
        });
        
        // Write manifest file
        const manifestPath = path.join(outputDir, 'glia-project.json');
        await writeFileAsync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
        
        manifestResult = {
          path: manifestPath,
          content: manifest
        };
      } catch (error) {
        console.warn(`Warning: Failed to generate project manifest: ${error.message}`);
      }
    }

    // Run post-initialization actions
    const postInitResults = [];
    if (template.postInit && Array.isArray(template.postInit)) {
      for (const action of template.postInit) {
        try {
          if (action.startsWith('Copy ') && action.includes(' to ')) {
            // Handle file copy
            const [_, sourcePath, targetPath] = action.match(/Copy (.*) to (.*)/);
            if (sourcePath && targetPath) {
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
            }
          } else if (action.startsWith('Install dependencies:')) {
            // Handle dependency installation
            const command = action.replace('Install dependencies:', '').trim();
            await execAsync(command, { cwd: outputDir });
            postInitResults.push({ action, success: true });
          } else if (action.startsWith('npm:')) {
            // Handle npm commands
            const command = action.replace('npm:', '').trim();
            await execAsync(`npm ${command}`, { cwd: outputDir });
            postInitResults.push({ action, success: true });
          } else {
            // Other actions are just logged
            postInitResults.push({ action, success: true });
          }
        } catch (error) {
          postInitResults.push({ 
            action, 
            success: false, 
            error: error.message 
          });
        }
      }
    }
    
    // Install dependencies specified in template
    if (template.dependencies && Array.isArray(template.dependencies) && template.dependencies.length > 0) {
      try {
        const deps = template.dependencies.join(' ');
        await execAsync(`npm install --save ${deps}`, { cwd: outputDir });
        postInitResults.push({ 
          action: `Install dependencies: ${deps}`, 
          success: true 
        });
      } catch (error) {
        postInitResults.push({ 
          action: 'Install dependencies', 
          success: false, 
          error: error.message 
        });
      }
    }
    
    // Install dev dependencies if specified
    if (template.devDependencies && Array.isArray(template.devDependencies) && template.devDependencies.length > 0) {
      try {
        const devDeps = template.devDependencies.join(' ');
        await execAsync(`npm install --save-dev ${devDeps}`, { cwd: outputDir });
        postInitResults.push({ 
          action: `Install dev dependencies: ${devDeps}`, 
          success: true 
        });
      } catch (error) {
        postInitResults.push({ 
          action: 'Install dev dependencies', 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return {
      template: template.name,
      type: template.type,
      outputDir,
      files: processedFiles,
      postInit: postInitResults,
      manifest: manifestResult
    };
  } catch (error) {
    console.error(`Error creating from template "${templateName}":`, error);
    throw new Error(`Failed to create from template: ${error.message}`);
  }
}

/**
 * Get all files in a directory recursively
 * 
 * @param {string} dir - Directory to scan
 * @param {string} baseDir - Base directory for relative paths
 * @returns {Promise<string[]>} Array of file paths relative to baseDir
 */
export async function getAllFilesInDir(dir, baseDir = undefined) {
  const baseDirToUse = baseDir || dir;
  const result = [];
  
  async function scanDir(currentDir) {
    const entries = await fs.promises.readdir(currentDir);
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stats = await fs.promises.stat(fullPath);
      
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

// Backward compatibility functions

/**
 * Create a function from template (legacy method)
 * 
 * @param {string} templateName - Name of the function template
 * @param {string} outputPath - Path to output file
 * @param {Object} options - Options for template processing
 * @returns {Promise<string>} Path to the created file
 */
export async function createFunctionFromTemplate(templateName, outputPath, options = {}) {
  const result = await createFromTemplate(templateName, path.dirname(outputPath), {
    type: 'function',
    variables: {
      functionName: options.functionName || path.basename(outputPath, '.js')
    },
    ...options
  });
  
  return outputPath;
}

/**
 * Get recommended environment variables for a template (legacy method)
 * 
 * @param {string} templateName - Name of the template
 * @returns {Promise<Object>} Object containing recommended environment variables
 */
export async function getTemplateEnvVars(templateName) {
  // Original template env vars mapping
  const templateEnvVars = {
    'api-integration': {
      API_KEY: 'your-api-key',
      API_URL: 'https://api.example.com/v1'
    },
    'ai-integration': {
      OPENAI_API_KEY: 'your-openai-api-key',
      MODEL: 'gpt-3.5-turbo',
      TEMPERATURE: '0.7',
      MAX_TOKENS: '500'
    },
    'kv-store-function': {
      EXAMPLE_CONFIG: 'sample-config-value',
      DEBUG_MODE: 'false'
    }
  };
  
  // Try to get template from registry
  try {
    const template = await getTemplate(templateName);
    if (template && template.envVars) {
      return template.envVars;
    }
  } catch (error) {
    // Ignore errors and fall back to original mapping
  }
  
  // Return environment variables for the requested template or an empty object
  return templateEnvVars[templateName] || {};
}

/**
 * Create a project from template (legacy method)
 * 
 * @param {string} templateName - Name of the project template
 * @param {string} outputDir - Directory where project will be created
 * @param {Object} variables - Values for template variables
 * @returns {Promise<Object>} Results of project creation
 */
export async function createProjectFromTemplate(templateName, outputDir, variables = {}) {
  return createFromTemplate(templateName, outputDir, {
    type: 'project',
    variables
  });
}

/**
 * List project templates (legacy method)
 * 
 * @returns {Promise<Object[]>} Array of project template objects
 */
export async function listProjectTemplates() {
  return listTemplates({ type: 'project' });
}

/**
 * Get a specific project template by name (legacy method)
 * 
 * @param {string} templateName - Name of the template
 * @returns {Promise<Object>} Template object
 */
export async function getProjectTemplate(templateName) {
  return getTemplate(templateName, 'project');
}

/**
 * Create an applet from template (legacy method)
 * 
 * @param {string} templateName - Name of the applet template
 * @param {string} outputDir - Directory where applet will be created
 * @param {Object} variables - Values for template variables
 * @returns {Promise<Object>} Results of applet creation
 */
export async function createAppletFromTemplate(templateName, outputDir, variables = {}) {
  return createFromTemplate(templateName, outputDir, {
    type: 'applet',
    variables
  });
}

/**
 * List applet templates (legacy method)
 * 
 * @returns {Promise<Object[]>} Array of applet template objects
 */
export async function listAppletTemplates() {
  return listTemplates({ type: 'applet' });
}

// Re-export validateTemplateVariables for convenience
export { validateTemplateVariables };

export default {
  listTemplates,
  getTemplate,
  createFromTemplate,
  getTemplateDefaultVars,
  validateTemplateVariables,
  createFunctionFromTemplate,
  createProjectFromTemplate,
  createAppletFromTemplate
};