/**
 * Project manifest validator
 * 
 * This module validates project manifests to ensure they meet the required format
 * and contain valid component references.
 */

import fs from 'fs/promises';
import path from 'path';
import { ValidationError } from './errors.js';
import { validateFunctionName } from './validation.js';

/**
 * Validate a project manifest file
 * 
 * @param {Object} manifest - The project manifest object
 * @returns {Promise<void>} - Resolves if valid, rejects with ValidationError if invalid
 */
export async function validateProjectManifest(manifest) {
  const errors = [];
  
  // Check required top-level fields
  if (!manifest.name) {
    errors.push('Project name is required');
  } else if (typeof manifest.name !== 'string') {
    errors.push('Project name must be a string');
  }
  
  if (!manifest.version) {
    errors.push('Project version is required');
  } else if (typeof manifest.version !== 'string') {
    errors.push('Project version must be a string');
  }
  
  // Check components section
  if (!manifest.components) {
    errors.push('Components section is required');
  } else {
    // Validate functions
    if (manifest.components.functions) {
      if (!Array.isArray(manifest.components.functions)) {
        errors.push('components.functions must be an array');
      } else {
        // Validate each function
        manifest.components.functions.forEach((func, index) => {
          validateFunction(func, index, errors);
        });
      }
    }
    
    // Validate applets
    if (manifest.components.applets) {
      if (!Array.isArray(manifest.components.applets)) {
        errors.push('components.applets must be an array');
      } else {
        // Validate each applet
        manifest.components.applets.forEach((applet, index) => {
          validateApplet(applet, index, errors);
        });
      }
    }
  }
  
  // Validate KV store configuration
  if (manifest.kvStore) {
    validateKvStore(manifest.kvStore, errors);
  }
  
  // Validate linkages if present
  if (manifest.linkages) {
    validateLinkages(manifest.linkages, manifest, errors);
  }
  
  // If any errors were found, throw a validation error
  if (errors.length > 0) {
    throw new ValidationError(
      `Invalid project manifest: ${errors.join('; ')}`,
      { errors },
      {}
    );
  }
}

/**
 * Validate a function configuration
 * 
 * @param {Object} func - Function configuration object
 * @param {number} index - Index in the functions array
 * @param {Array<string>} errors - Array to collect validation errors
 */
function validateFunction(func, index, errors) {
  if (!func.name) {
    errors.push(`Function ${index}: name is required`);
  } else {
    try {
      validateFunctionName(func.name);
    } catch (error) {
      errors.push(`Function ${index}: ${error.message}`);
    }
  }
  
  if (!func.path) {
    errors.push(`Function ${index}: path is required`);
  }
  
  // Validate KV store references
  if (func.kvStore) {
    if (!func.kvStore.namespaces || !Array.isArray(func.kvStore.namespaces)) {
      errors.push(`Function ${index}: kvStore.namespaces must be an array`);
    } else if (func.kvStore.namespaces.some(ns => typeof ns !== 'string')) {
      errors.push(`Function ${index}: kvStore.namespaces must contain only strings`);
    }
    
    // Note: KV store permissions are not currently supported by the platform
    // Keeping validation code commented out for potential future implementation
    /*
    if (func.kvStore.permissions) {
      if (!Array.isArray(func.kvStore.permissions)) {
        errors.push(`Function ${index}: kvStore.permissions must be an array`);
      } else {
        const validPermissions = ['read', 'write', 'delete'];
        for (const perm of func.kvStore.permissions) {
          if (!validPermissions.includes(perm)) {
            errors.push(`Function ${index}: Invalid permission '${perm}'. Must be one of: ${validPermissions.join(', ')}`);
          }
        }
      }
    }
    */
  }
}

/**
 * Validate an applet configuration
 * 
 * @param {Object} applet - Applet configuration object
 * @param {number} index - Index in the applets array
 * @param {Array<string>} errors - Array to collect validation errors
 */
function validateApplet(applet, index, errors) {
  if (!applet.name) {
    errors.push(`Applet ${index}: name is required`);
  }
  
  if (!applet.path) {
    errors.push(`Applet ${index}: path is required`);
  }
  
  if (applet.scope && !['engagement', 'global'].includes(applet.scope)) {
    errors.push(`Applet ${index}: scope must be 'engagement' or 'global'`);
  }
}

/**
 * Validate KV store configuration
 * 
 * @param {Object} kvStore - KV store configuration
 * @param {Array<string>} errors - Array to collect validation errors
 */
function validateKvStore(kvStore, errors) {
  if (!kvStore.namespaces || !Array.isArray(kvStore.namespaces)) {
    errors.push('kvStore.namespaces must be an array');
    return;
  }
  
  // Track namespace names to check for duplicates
  const namespaceNames = new Set();
  
  kvStore.namespaces.forEach((namespace, index) => {
    if (!namespace.name) {
      errors.push(`KV Namespace ${index}: name is required`);
    } else if (typeof namespace.name !== 'string') {
      errors.push(`KV Namespace ${index}: name must be a string`);
    } else {
      // Check for duplicate namespace names
      if (namespaceNames.has(namespace.name)) {
        errors.push(`KV Namespace ${index}: duplicate namespace name '${namespace.name}'`);
      }
      namespaceNames.add(namespace.name);
      
      // Validate namespace name format
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(namespace.name)) {
        errors.push(`KV Namespace ${index}: name '${namespace.name}' must match pattern ^[a-zA-Z0-9][a-zA-Z0-9_-]*$`);
      }
      
      // Check name length (max 128 bytes)
      if (Buffer.from(namespace.name).length > 128) {
        errors.push(`KV Namespace ${index}: name exceeds maximum length of 128 bytes`);
      }
    }
    
    // Validate TTL if present
    if (namespace.ttl !== undefined) {
      if (typeof namespace.ttl !== 'number' || namespace.ttl <= 0) {
        errors.push(`KV Namespace ${index}: ttl must be a positive number`);
      }
    }
    
    // Note: Initial data is not directly supported by the platform
    // Keeping validation code commented out for potential future implementation
    /*
    // Validate initial data if present
    if (namespace.initialData) {
      if (!Array.isArray(namespace.initialData)) {
        errors.push(`KV Namespace ${index}: initialData must be an array`);
      } else {
        namespace.initialData.forEach((item, itemIndex) => {
          if (!item.key) {
            errors.push(`KV Namespace ${index}, Item ${itemIndex}: key is required`);
          } else if (typeof item.key !== 'string') {
            errors.push(`KV Namespace ${index}, Item ${itemIndex}: key must be a string`);
          } else if (Buffer.from(item.key).length > 512) {
            errors.push(`KV Namespace ${index}, Item ${itemIndex}: key exceeds maximum length of 512 bytes`);
          }
          
          if (item.value === undefined) {
            errors.push(`KV Namespace ${index}, Item ${itemIndex}: value is required`);
          }
          
          // Validate TTL if present
          if (item.ttl !== undefined && (typeof item.ttl !== 'number' || item.ttl <= 0)) {
            errors.push(`KV Namespace ${index}, Item ${itemIndex}: ttl must be a positive number`);
          }
        });
      }
    }
    */
  });
}

/**
 * Validate linkages between components
 * 
 * @param {Array} linkages - Array of linkage definitions
 * @param {Object} manifest - Full manifest for reference
 * @param {Array<string>} errors - Array to collect validation errors
 */
function validateLinkages(linkages, manifest, errors) {
  if (!Array.isArray(linkages)) {
    errors.push('linkages must be an array');
    return;
  }
  
  linkages.forEach((linkage, index) => {
    if (!linkage.from) {
      errors.push(`Linkage ${index}: from is required`);
    } else {
      // Check from reference exists
      validateComponentReference(linkage.from, manifest, `Linkage ${index}: from`, errors);
    }
    
    if (!linkage.to) {
      errors.push(`Linkage ${index}: to is required`);
    } else {
      // Check to reference exists
      validateComponentReference(linkage.to, manifest, `Linkage ${index}: to`, errors);
    }
    
    // Validate placeholders
    if (linkage.placeholders) {
      if (typeof linkage.placeholders !== 'object' || Array.isArray(linkage.placeholders)) {
        errors.push(`Linkage ${index}: placeholders must be an object`);
      }
    }
  });
}

/**
 * Validate a component reference
 * 
 * @param {string} reference - Component reference string (e.g. "functions.my-function")
 * @param {Object} manifest - Full manifest for reference
 * @param {string} context - Error context for messages
 * @param {Array<string>} errors - Array to collect validation errors
 */
function validateComponentReference(reference, manifest, context, errors) {
  const parts = reference.split('.');
  if (parts.length !== 2) {
    errors.push(`${context}: invalid reference format '${reference}', expected "type.name"`);
    return;
  }
  
  const [type, name] = parts;
  
  if (!['functions', 'applets'].includes(type)) {
    errors.push(`${context}: invalid component type '${type}', expected "functions" or "applets"`);
    return;
  }
  
  // Check if the component exists
  if (!manifest.components || !manifest.components[type]) {
    errors.push(`${context}: ${type} section not found in manifest`);
    return;
  }
  
  const component = manifest.components[type].find(comp => comp.name === name);
  if (!component) {
    errors.push(`${context}: component ${type}.${name} not found in manifest`);
  }
}

/**
 * Validate component file paths exist
 * 
 * @param {Object} manifest - The project manifest object
 * @param {string} projectRoot - Project root directory path
 * @returns {Promise<void>} - Resolves if valid, rejects with ValidationError if invalid
 */
export async function validateComponentFiles(manifest, projectRoot) {
  const errors = [];
  const components = manifest.components || {};
  
  // Check all function paths
  if (components.functions) {
    for (const func of components.functions) {
      if (func.path) {
        try {
          const fullPath = path.resolve(projectRoot, func.path);
          await fs.access(fullPath);
        } catch (error) {
          errors.push(`Function '${func.name}': file not found at '${func.path}'`);
        }
      }
    }
  }
  
  // Check all applet paths
  if (components.applets) {
    for (const applet of components.applets) {
      if (applet.path) {
        try {
          const fullPath = path.resolve(projectRoot, applet.path);
          await fs.access(fullPath);
        } catch (error) {
          errors.push(`Applet '${applet.name}': file not found at '${applet.path}'`);
        }
      }
    }
  }
  
  // If any errors were found, throw a validation error
  if (errors.length > 0) {
    throw new ValidationError(
      `Invalid component files: ${errors.join('; ')}`,
      { errors },
      {}
    );
  }
}

/**
 * Validates that function KV store namespaces are defined in the project
 * 
 * @param {Object} manifest - The project manifest object
 * @returns {Promise<void>} - Resolves if valid, rejects with ValidationError if invalid
 */
export async function validateKvNamespaceReferences(manifest) {
  const errors = [];
  const components = manifest.components || {};
  
  // Create a set of defined namespaces
  const definedNamespaces = new Set();
  if (manifest.kvStore && Array.isArray(manifest.kvStore.namespaces)) {
    manifest.kvStore.namespaces.forEach(ns => {
      if (ns.name) {
        definedNamespaces.add(ns.name);
      }
    });
  }
  
  // Check all function KV store references
  if (components.functions) {
    for (const func of components.functions) {
      if (func.kvStore && Array.isArray(func.kvStore.namespaces)) {
        for (const namespace of func.kvStore.namespaces) {
          if (!definedNamespaces.has(namespace)) {
            errors.push(`Function '${func.name}': references undefined KV namespace '${namespace}'`);
          }
        }
      }
    }
  }
  
  // If any errors were found, throw a validation error
  if (errors.length > 0) {
    throw new ValidationError(
      `Invalid KV namespace references: ${errors.join('; ')}`,
      { errors },
      {}
    );
  }
}