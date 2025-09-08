/**
 * Package.json Template Manager
 * 
 * This utility provides functionality for managing package.json templates
 * and integrating them into the template inheritance system.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

// Import dependency registry
import dependencyRegistry from './dependency-registry.js';

// Import template utilities
import { validateTemplateVariables } from './template-engine.js';

// Convert callback-based fs functions to Promise-based
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const existsAsync = promisify(fs.exists);

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to base package templates
const BASE_PACKAGE_PATH = path.resolve(__dirname, '../templates/base-packages');

/**
 * Get the path to a package.json template file
 * 
 * @param {string} templateName - Name of the package template
 * @returns {string} Path to the template file
 */
export function getPackageTemplatePath(templateName) {
  return path.join(BASE_PACKAGE_PATH, `${templateName}.package.json`);
}

/**
 * Read a package.json template
 * 
 * @param {string} templateName - Name of the package template
 * @returns {Promise<Object>} Template object
 */
export async function readPackageTemplate(templateName) {
  const templatePath = getPackageTemplatePath(templateName);
  
  try {
    if (!await existsAsync(templatePath)) {
      throw new Error(`Package template not found: ${templateName}`);
    }
    
    const content = await readFileAsync(templatePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Error reading package template ${templateName}: ${error.message}`);
  }
}

/**
 * Process a package.json template with variables
 * 
 * @param {Object} template - Template object
 * @param {Object} variables - Values for template variables
 * @returns {Object} Processed template
 */
export function processPackageTemplate(template, variables) {
  // Deep clone the template
  const processed = JSON.parse(JSON.stringify(template));
  
  // Process each field recursively
  function processValue(value) {
    if (typeof value === 'string') {
      // Replace variables in string
      return value.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
        return variables[varName] !== undefined ? variables[varName] : match;
      });
    } else if (Array.isArray(value)) {
      // Process arrays
      return value.map(item => processValue(item));
    } else if (value && typeof value === 'object') {
      // Process objects
      const result = {};
      Object.entries(value).forEach(([key, val]) => {
        result[key] = processValue(val);
      });
      return result;
    }
    
    // Return other types as-is
    return value;
  }
  
  // Process the whole template
  return processValue(processed);
}

/**
 * Merge package.json objects with special handling for arrays and nested objects
 * 
 * @param {Object} base - Base package.json object
 * @param {Object} extension - Extension package.json object
 * @returns {Object} Merged package.json object
 */
export function mergePackageJson(base, extension) {
  if (!base) return extension;
  if (!extension) return base;
  
  // Start with a deep copy of the base
  const result = JSON.parse(JSON.stringify(base));
  
  // Process extension
  Object.entries(extension).forEach(([key, value]) => {
    // Special handling for arrays that should be concatenated
    if (Array.isArray(value) && Array.isArray(result[key])) {
      if (['keywords', 'files'].includes(key)) {
        // Concatenate unique values
        result[key] = [...new Set([...result[key], ...value])];
      } else {
        // Replace array
        result[key] = [...value];
      }
    }
    // Special handling for objects that should be merged
    else if (value && typeof value === 'object' && result[key] && typeof result[key] === 'object') {
      if (['dependencies', 'devDependencies', 'peerDependencies', 'scripts'].includes(key)) {
        // Merge objects with extension taking precedence
        result[key] = { ...result[key], ...value };
      } else {
        // Deep merge nested objects
        result[key] = mergePackageJson(result[key], value);
      }
    }
    // Default case: extension overrides base
    else {
      result[key] = value;
    }
  });
  
  return result;
}

/**
 * Generate a package.json file for a template
 * 
 * @param {Object} template - Template object with resolved inheritance
 * @param {Object} variables - Values for template variables
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Generated package.json object
 */
export async function generatePackageJson(template, variables, options = {}) {
  try {
    // Get base package.json templates based on template configuration
    let basePackage = {};
    
    // Start with package.json inheritance if specified
    if (template.packageJson && template.packageJson.inherits) {
      try {
        basePackage = await readPackageTemplate(template.packageJson.inherits);
      } catch (error) {
        console.warn(`Warning: Failed to load package template ${template.packageJson.inherits}: ${error.message}`);
      }
    } else {
      // Default to base template based on type
      const defaultBase = template.type === 'project' ? 'base-project' : 'base-function';
      try {
        basePackage = await readPackageTemplate(defaultBase);
      } catch (error) {
        console.warn(`Warning: Failed to load default package template ${defaultBase}: ${error.message}`);
      }
    }
    
    // Process template components
    let componentPackages = {};
    if (template.packageJson && template.packageJson.components) {
      for (const component of template.packageJson.components) {
        try {
          // Split component into type and name
          const [type, name] = component.split('/');
          
          // Handle script collections
          if (type === 'scripts') {
            componentPackages = mergePackageJson(componentPackages, {
              scripts: dependencyRegistry.getScripts(name)
            });
          }
          // Handle dependency collections
          else if (type === 'dependencies') {
            const deps = dependencyRegistry.getDependenciesForFeature(name);
            componentPackages = mergePackageJson(componentPackages, {
              dependencies: deps
            });
          }
        } catch (error) {
          console.warn(`Warning: Failed to process component ${component}: ${error.message}`);
        }
      }
    }
    
    // Merge base, components, and customizations
    let packageJson = mergePackageJson(basePackage, componentPackages);
    
    // Apply customizations
    if (template.packageJson && template.packageJson.customizations) {
      packageJson = mergePackageJson(packageJson, template.packageJson.customizations);
    }
    
    // Apply project-specific variables
    const projectName = variables.projectName || template.name;
    const description = variables.description || template.description || `A Glia Functions ${template.type}`;
    const mainFile = variables.mainFile || 'function.js';
    const author = variables.author || '';
    
    const templateVars = {
      projectName,
      description,
      mainFile,
      author,
      ...variables
    };
    
    // Process template with variables
    return processPackageTemplate(packageJson, templateVars);
  } catch (error) {
    throw new Error(`Failed to generate package.json: ${error.message}`);
  }
}

/**
 * Apply package.json template to a template object
 * 
 * @param {Object} template - Template object
 * @param {Object} variables - Values for template variables
 * @returns {Promise<Object>} Modified template object with package.json handling
 */
export async function applyPackageJsonTemplate(template, variables) {
  // Skip if template already has package.json handling
  if (template._packageJsonApplied) {
    return template;
  }
  
  // Clone the template
  const result = JSON.parse(JSON.stringify(template));
  
  // Skip if the template explicitly disables package.json generation
  if (result.packageJson && result.packageJson.disabled === true) {
    result._packageJsonApplied = true;
    return result;
  }
  
  // Add package.json to files if not already present
  const files = result.files || [];
  const hasPackageJson = files.some(file => {
    if (typeof file === 'string') {
      return file === 'package.json';
    } else if (file && typeof file === 'object') {
      return file.source === 'package.json' || file.destination === 'package.json';
    }
    return false;
  });
  
  if (!hasPackageJson) {
    // Add special file handler for package.json
    result.files = [...files, {
      source: 'package.json',
      destination: 'package.json',
      _packageTemplate: true
    }];
  }
  
  // Add post-init action if not already present
  const postInit = result.postInit || [];
  const hasNpmInstall = postInit.some(action => 
    action === 'npm:install' || action.startsWith('Install dependencies')
  );
  
  if (!hasNpmInstall) {
    result.postInit = [...postInit, 'npm:install'];
  }
  
  // Mark as processed
  result._packageJsonApplied = true;
  
  return result;
}

/**
 * Process a template file with special handling for package.json
 * 
 * @param {Object} fileSpec - File specification object
 * @param {Object} template - Template object
 * @param {string} outputDir - Output directory
 * @param {Object} variables - Values for template variables
 * @returns {Promise<Object>} Result of file processing
 */
export async function processPackageJsonFile(fileSpec, template, outputDir, variables) {
  try {
    // Check if this is a package.json file with template marker
    if (fileSpec._packageTemplate || 
        fileSpec.destination === 'package.json' || 
        fileSpec.source === 'package.json') {
      
      // Generate package.json content
      const packageJson = await generatePackageJson(template, variables);
      
      // Write to target file
      const targetPath = path.join(outputDir, 'package.json');
      await writeFileAsync(targetPath, JSON.stringify(packageJson, null, 2), 'utf8');
      
      return {
        source: 'package.json',
        target: targetPath,
        success: true,
        generated: true
      };
    }
    
    // Not a package.json file
    return null;
  } catch (error) {
    console.error(`Error processing package.json file:`, error);
    return {
      source: 'package.json',
      target: path.join(outputDir, 'package.json'),
      success: false,
      error: error.message
    };
  }
}

export default {
  getPackageTemplatePath,
  readPackageTemplate,
  processPackageTemplate,
  mergePackageJson,
  generatePackageJson,
  applyPackageJsonTemplate,
  processPackageJsonFile
};