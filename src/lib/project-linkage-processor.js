/**
 * Project linkage processor
 * 
 * This module processes linkages between functions and applets,
 * substituting function URIs into applet HTML content.
 */

import fs from 'fs/promises';
import path from 'path';
import { ValidationError } from './errors.js';

/**
 * Process linkages between functions and applets
 * 
 * @param {Object} manifest - Project manifest
 * @param {Object} deployedFunctions - Map of function names to deployment details
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<Array>} - Processed applets with injected URIs
 */
export async function processLinkages(manifest, deployedFunctions, projectRoot) {
  const components = manifest.components || {};
  const applets = components.applets || [];
  const linkages = manifest.linkages || [];
  
  // Clone applets to avoid modifying the original manifest
  const processedApplets = JSON.parse(JSON.stringify(applets));
  
  // Read all applet sources first
  for (const applet of processedApplets) {
    try {
      const appletPath = path.resolve(projectRoot, applet.path);
      applet.originalSource = await fs.readFile(appletPath, 'utf8');
      applet.processedSource = applet.originalSource;
    } catch (error) {
      throw new Error(`Failed to read applet file: ${applet.path}`);
    }
  }
  
  // Process each linkage
  for (const linkage of linkages) {
    const { from, to, placeholders } = linkage;
    
    // Validate linkage structure
    if (!from || !to || !placeholders) {
      continue;
    }
    
    // Parse component references
    const fromParts = from.split('.');
    const toParts = to.split('.');
    
    if (fromParts.length !== 2 || toParts.length !== 2) {
      throw new ValidationError(`Invalid linkage reference format: ${from} -> ${to}`);
    }
    
    const [fromType, fromName] = fromParts;
    const [toType, toName] = toParts;
    
    // Only function -> applet linkages are supported for now
    if (fromType !== 'functions' || toType !== 'applets') {
      throw new ValidationError(`Unsupported linkage type: ${fromType} -> ${toType}`);
    }
    
    // Get the deployed function
    const functionData = deployedFunctions[fromName];
    if (!functionData) {
      throw new ValidationError(`Function not deployed: ${fromName}`);
    }
    
    // Find the target applet
    const targetApplet = processedApplets.find(a => a.name === toName);
    if (!targetApplet) {
      throw new ValidationError(`Applet not found: ${toName}`);
    }
    
    // Process each placeholder
    for (const [placeholder, functionProperty] of Object.entries(placeholders)) {
      const value = getNestedProperty(functionData, functionProperty);
      
      if (value === undefined) {
        throw new ValidationError(
          `Function property not found: ${functionProperty} in ${fromName}`
        );
      }
      
      // Replace placeholders in the applet source
      targetApplet.processedSource = targetApplet.processedSource.replace(
        new RegExp(escapeRegExp(placeholder), 'g'),
        value.toString()
      );
    }
  }
  
  return processedApplets;
}

/**
 * Get a nested property from an object using a dot-notation path
 * 
 * @param {Object} obj - Object to get property from
 * @param {string} path - Property path (e.g. "foo.bar.baz")
 * @returns {*} - Property value or undefined if not found
 */
function getNestedProperty(obj, path) {
  return path.split('.').reduce((current, part) => {
    return current && current[part] !== undefined ? current[part] : undefined;
  }, obj);
}

/**
 * Escape special characters for use in a regular expression
 * 
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Process variables in a string template
 * 
 * @param {string} template - String template with ${var} placeholders
 * @param {Object} variables - Variables to substitute
 * @returns {string} - Processed string
 */
export function processVariables(template, variables) {
  if (typeof template !== 'string') {
    return template;
  }
  
  return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
    const value = getNestedProperty(variables, path);
    if (value === undefined) {
      throw new ValidationError(`Variable not found: ${path}`);
    }
    return value.toString();
  });
}