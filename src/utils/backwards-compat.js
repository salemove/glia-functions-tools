/**
 * Backwards Compatibility Layer
 * 
 * This module provides adapters and utilities to maintain backwards compatibility
 * with older versions of the CLI and templates.
 */

import fs from 'fs';
import path from 'path';
import { getTemplateByName } from './template-registry.js';
import { createFromTemplate } from './unified-template-manager.js';

/**
 * Legacy template name mapping
 * Maps old template names to their new equivalents
 */
const LEGACY_TEMPLATE_MAPPING = {
  // Function templates
  'basic-function': 'basic',
  'simple-api': 'api-integration',
  'export-handler': 'export-handler-base',
  
  // Project templates
  'export-engagement-start': 'export-handler-engagement-start',
  'export-engagement-end': 'export-handler-engagement-end',
  'export-engagement-transfer': 'export-handler-engagement-transfer',
  'export-presence-update': 'export-handler-presence-update',
  
  // Legacy applet templates
  'simple-html': 'basic-html',
};

/**
 * Get a template by name with legacy fallback support
 * 
 * @param {string} templateName - Name of the template (may be legacy name)
 * @param {string} templateType - Optional type of template to filter by
 * @returns {Promise<Object>} Template object
 */
export async function getTemplateWithFallback(templateName, templateType = null) {
  try {
    // First try to get the template directly
    return await getTemplateByName(templateName, false, true);
  } catch (error) {
    // Check if it's a legacy template name
    const mappedName = LEGACY_TEMPLATE_MAPPING[templateName];
    if (mappedName) {
      console.log(`Note: '${templateName}' is a legacy template name, using '${mappedName}' instead`);
      return await getTemplateByName(mappedName, false, true);
    }
    
    // Not found, re-throw the error
    throw error;
  }
}

/**
 * Create from template with legacy support
 * 
 * @param {string} templateName - Name of the template (may be legacy name)
 * @param {string} outputDir - Directory where files will be created
 * @param {Object} options - Options for template processing
 * @returns {Promise<Object>} Results of template creation
 */
export async function createFromTemplateWithFallback(templateName, outputDir, options = {}) {
  try {
    // First try to create directly
    return await createFromTemplate(templateName, outputDir, options);
  } catch (error) {
    // Check if it's a legacy template name
    const mappedName = LEGACY_TEMPLATE_MAPPING[templateName];
    if (mappedName) {
      console.log(`Note: '${templateName}' is a legacy template name, using '${mappedName}' instead`);
      return await createFromTemplate(mappedName, outputDir, options);
    }
    
    // Not found, re-throw the error
    throw error;
  }
}

/**
 * Check if an old CLI command needs to be redirected
 * 
 * @param {string} command - Command name
 * @returns {string|null} New command name or null if no redirection needed
 */
export function redirectLegacyCommand(command) {
  const legacyCommandMapping = {
    'create-gf': 'create-function',
    'list-gf': 'list-functions',
    'setup': 'init',
    'generate-token': 'auth',
    'setup-export': 'setup-export-handler'
  };
  
  return legacyCommandMapping[command] || null;
}

/**
 * Create paths for legacy template structure if they don't exist
 * This allows older scripts that expect the old paths to still work
 * 
 * @returns {Promise<void>}
 */
export async function ensureLegacyPaths() {
  // Legacy paths that might be expected by older scripts
  const legacyPaths = [
    './templates',
    './templates/functions',
    './templates/projects'
  ];
  
  for (const dirPath of legacyPaths) {
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  }
  
  // Create a .gitkeep file to ensure directories are tracked in git
  for (const dirPath of legacyPaths) {
    const gitkeepPath = path.join(dirPath, '.gitkeep');
    if (!fs.existsSync(gitkeepPath)) {
      await fs.promises.writeFile(gitkeepPath, '# Legacy directory for backwards compatibility\n');
    }
  }
}

export default {
  getTemplateWithFallback,
  createFromTemplateWithFallback,
  redirectLegacyCommand,
  ensureLegacyPaths,
  LEGACY_TEMPLATE_MAPPING
};