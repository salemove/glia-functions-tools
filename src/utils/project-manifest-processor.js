/**
 * Project manifest processor
 * 
 * This module handles the creation and processing of project manifest files
 * for multi-component Glia projects.
 */
import fs from 'fs/promises';
import path from 'path';

import { validate } from './schema-validator.js';
import { projectManifestSchema } from '../schemas/project-manifest.js';
import { processTemplate } from './template-engine.js';
import { 
  isGliaFunction, 
  isGliaApplet, 
  detectKvNamespaces,
  findJavaScriptFiles,
  findHtmlFiles 
} from './component-detector.js';

/**
 * Process project manifest from template
 * 
 * @param {Object} template - Template object with projectManifest section
 * @param {Object} variables - Template variables
 * @param {string} outputDir - Project output directory
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processed project manifest
 */
export async function processProjectManifest(template, variables, outputDir, options = {}) {
  const { 
    autoDiscover = true, 
    validateManifest = true,
    maxFilesToScan = 100,
    scanTimeout = 5000 // ms
  } = options;
  
  try {
    // Start with template manifest or create empty one
    let manifestBase;
    
    if (template.projectManifest) {
      // Use template's manifest as base
      manifestBase = JSON.parse(JSON.stringify(template.projectManifest));
    } else {
      // Create default manifest
      manifestBase = {
        name: variables.projectName || path.basename(outputDir),
        version: variables.version || "1.0.0",
        description: variables.description || `Project generated from ${template.name} template`,
        components: {
          functions: [],
          applets: []
        },
        kvStore: {
          namespaces: []
        },
        linkages: []
      };
    }
    
    // Process variable substitutions throughout manifest
    const manifestWithVars = processTemplateObject(manifestBase, variables);
    
    // Auto-discover components if enabled and needed
    if (autoDiscover && 
        (!template.projectManifest || 
         manifestWithVars.components.functions.length === 0 && 
         manifestWithVars.components.applets.length === 0)) {
      
      // Set a timeout for the discovery process
      const discoveryPromise = autoDiscoverComponents(
        manifestWithVars, 
        outputDir, 
        { maxFiles: maxFilesToScan }
      );
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Component discovery timed out')), scanTimeout);
      });
      
      try {
        await Promise.race([discoveryPromise, timeoutPromise]);
      } catch (error) {
        console.warn(`Warning: ${error.message}. Proceeding with basic manifest.`);
      }
    }
    
    // Validate the manifest if required
    if (validateManifest) {
      const validationResult = validate(manifestWithVars, projectManifestSchema);
      if (!validationResult.valid) {
        throw new Error(`Invalid project manifest: ${validationResult.errors.join('; ')}`);
      }
    }
    
    return manifestWithVars;
  } catch (error) {
    console.error('Error processing project manifest:', error);
    throw error;
  }
}

/**
 * Process templates within an object (deep)
 * 
 * @param {Object} obj - Object to process
 * @param {Object} variables - Template variables
 * @returns {Object} Processed object
 */
function processTemplateObject(obj, variables) {
  if (typeof obj === 'string') {
    return processTemplate(obj, variables);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => processTemplateObject(item, variables));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = processTemplateObject(value, variables);
    }
    return result;
  }
  
  return obj;
}

/**
 * Auto-discover components in the project directory
 * 
 * @param {Object} manifest - Manifest object to update
 * @param {string} outputDir - Project directory
 * @param {Object} options - Discovery options
 * @returns {Promise<void>}
 */
export async function autoDiscoverComponents(manifest, outputDir, options = {}) {
  const { maxFiles = 100 } = options;
  
  try {
    // Find all JS files that could be functions
    const jsFiles = await findJavaScriptFiles(outputDir);
    
    // Limit files to scan
    const jsFilesToScan = jsFiles.slice(0, maxFiles);
    if (jsFiles.length > maxFiles) {
      console.warn(`Warning: Limiting JS file scan to ${maxFiles} files out of ${jsFiles.length}`);
    }
    
    // Process potential function files
    for (const file of jsFilesToScan) {
      await processJsFile(file, manifest, outputDir);
    }
    
    // Find all HTML files that could be applets
    const htmlFiles = await findHtmlFiles(outputDir);
    
    // Limit files to scan
    const htmlFilesToScan = htmlFiles.slice(0, maxFiles);
    if (htmlFiles.length > maxFiles) {
      console.warn(`Warning: Limiting HTML file scan to ${maxFiles} files out of ${htmlFiles.length}`);
    }
    
    // Process potential applet files
    for (const file of htmlFilesToScan) {
      await processHtmlFile(file, manifest, outputDir);
    }
    
    // If we found functions and applets, try to create linkages
    if (manifest.components.functions.length > 0 && 
        manifest.components.applets.length > 0 &&
        manifest.linkages.length === 0) {
      await createDefaultLinkages(manifest, outputDir);
    }
    
    return manifest;
  } catch (error) {
    console.warn(`Error during component auto-discovery: ${error.message}`);
    throw error;
  }
}

/**
 * Process a JavaScript file for potential functions
 * 
 * @param {string} filePath - Path to JS file
 * @param {Object} manifest - Manifest to update
 * @param {string} outputDir - Project root directory
 */
async function processJsFile(filePath, manifest, outputDir) {
  try {
    // Check if file is a Glia function
    if (await isGliaFunction(filePath)) {
      const relativePath = path.relative(outputDir, filePath);
      const name = path.basename(filePath, '.js');
      
      // Check if function already exists in manifest
      if (!manifest.components.functions.find(f => f.path === relativePath)) {
        manifest.components.functions.push({
          name,
          description: `${name} function`,
          path: relativePath
        });
        
        // Check for KV namespaces
        const kvNamespaces = await detectKvNamespaces(filePath);
        if (kvNamespaces.length > 0) {
          manifest.components.functions[manifest.components.functions.length - 1].kvStore = {
            namespaces: kvNamespaces
          };
          
          // Add to KV store section if not present
          for (const ns of kvNamespaces) {
            if (!manifest.kvStore.namespaces.find(n => n.name === ns)) {
              manifest.kvStore.namespaces.push({
                name: ns,
                description: `${ns} namespace`,
                ttl: 86400 // Default TTL
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Error processing JS file ${filePath}: ${error.message}`);
  }
}

/**
 * Process an HTML file for potential applets
 * 
 * @param {string} filePath - Path to HTML file
 * @param {Object} manifest - Manifest to update
 * @param {string} outputDir - Project root directory
 */
async function processHtmlFile(filePath, manifest, outputDir) {
  try {
    // Check if file is a Glia applet
    if (await isGliaApplet(filePath)) {
      const relativePath = path.relative(outputDir, filePath);
      const name = path.basename(filePath, '.html');
      
      // Check if applet already exists in manifest
      if (!manifest.components.applets.find(a => a.path === relativePath)) {
        manifest.components.applets.push({
          name,
          description: `${name} applet`,
          path: relativePath,
          scope: "engagement" // Default scope
        });
      }
    }
  } catch (error) {
    console.warn(`Warning: Error processing HTML file ${filePath}: ${error.message}`);
  }
}

/**
 * Create default linkages between functions and applets
 * 
 * @param {Object} manifest - Manifest to update
 * @param {string} outputDir - Project root directory
 */
async function createDefaultLinkages(manifest, outputDir) {
  try {
    // For each applet, check for placeholders that might need linking
    for (const applet of manifest.components.applets) {
      const appletPath = path.join(outputDir, applet.path);
      
      try {
        const content = await fs.readFile(appletPath, 'utf8');
        
        // Look for placeholder patterns
        const placeholderRegex = /\${([A-Za-z0-9_]+)}/g;
        const matches = [...content.matchAll(placeholderRegex)];
        
        if (matches.length > 0) {
          const placeholders = {};
          matches.forEach(match => {
            placeholders[match[1]] = "invocation_uri";
          });
          
          // Create linkage with first function as a reasonable default
          manifest.linkages.push({
            from: `functions.${manifest.components.functions[0].name}`,
            to: `applets.${applet.name}`,
            placeholders
          });
        }
      } catch (error) {
        console.warn(`Warning: Could not analyze applet file ${appletPath} for linkages: ${error.message}`);
      }
    }
  } catch (error) {
    console.warn(`Warning: Error creating default linkages: ${error.message}`);
  }
}

export default {
  processProjectManifest,
  autoDiscoverComponents
};