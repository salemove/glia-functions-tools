/**
 * Template Registry Utility
 * 
 * This utility provides functionality for discovering and managing templates,
 * creating a registry that categorizes templates by type, name, and tags.
 * It also supports project manifests for multi-component deployments.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

// Import package template manager for merging package.json configs
import packageTemplateManager from './package-template-manager.js';

// Convert callback-based fs functions to Promise-based
const readFileAsync = promisify(fs.readFile);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const mkdirAsync = promisify(fs.mkdir);

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to base template directories
export let BASE_TEMPLATE_PATHS = {
  function: path.resolve(__dirname, '../templates/functions'),
  project: path.resolve(__dirname, '../templates/projects'),
  applet: path.resolve(__dirname, '../templates/applets'),
  custom: path.resolve(process.env.HOME || process.env.USERPROFILE || '.', '.glia-cli/templates')
};

// Cache for the template registry
export let templateRegistry = null;

/**
 * Point the registry at a different set of template roots.
 *
 * `BASE_TEMPLATE_PATHS` is an `export let`, which cannot be assigned from
 * outside the module, so there was previously no way to redirect template
 * discovery — the only option was to mock `node:fs` wholesale. Overriding the
 * roots also clears the registry cache, since it is no longer valid.
 *
 * @param {Object} paths - Partial map of template type to directory
 * @returns {Object} The resulting template paths
 */
export function setBaseTemplatePaths(paths) {
  BASE_TEMPLATE_PATHS = { ...BASE_TEMPLATE_PATHS, ...paths };
  templateRegistry = null;
  return BASE_TEMPLATE_PATHS;
}

/**
 * Discard the cached registry so the next read rediscovers from disk.
 */
export function clearTemplateRegistryCache() {
  templateRegistry = null;
}

/**
 * Validate a template object's structure
 * 
 * @param {Object} template - Template object to validate
 * @throws {Error} If validation fails
 */
function validateTemplate(template) {
  if (!template.name) {
    throw new Error('Template name is required');
  }
  
  // Validate projectManifest if present
  if (template.projectManifest) {
    if (typeof template.projectManifest !== 'object') {
      throw new Error(`Template ${template.name}: projectManifest must be an object`);
    }
    
    // Basic structure validation
    if (!template.projectManifest.name) {
      throw new Error(`Template ${template.name}: projectManifest must have a name property`);
    }
    
    if (template.projectManifest.components && typeof template.projectManifest.components !== 'object') {
      throw new Error(`Template ${template.name}: projectManifest.components must be an object`);
    }
  }
  
  return true;
}

/**
 * Read template metadata from a template directory
 * 
 * @param {string} templateDir - Path to the template directory
 * @returns {Promise<Object|null>} Template metadata or null if invalid/missing
 */
export async function readTemplateMetadata(templateDir) {
  try {
    const templateJsonPath = path.join(templateDir, 'template.json');
    
    if (!fs.existsSync(templateJsonPath)) {
      return null;
    }
    
    const content = await readFileAsync(templateJsonPath, 'utf8');
    const metadata = JSON.parse(content);
    
    // Validate template structure
    try {
      validateTemplate(metadata);
    } catch (error) {
      console.warn(`Invalid template at ${templateDir}: ${error.message}`);
      return null;
    }
    
    // Add path to metadata
    metadata.path = templateDir;
    
    return metadata;
  } catch (error) {
    console.warn(`Error reading template metadata at ${templateDir}:`, error);
    return null;
  }
}

/**
 * Discover templates in a directory
 * 
 * @param {string} dirPath - Directory to search for templates
 * @param {string} type - Type of templates to discover
 * @returns {Promise<Object[]>} Array of template objects
 */
export async function discoverTemplates(dirPath, type) {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    
    const entries = await readdirAsync(dirPath);
    const templates = [];
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      let stats;
      
      try {
        stats = await statAsync(entryPath);
      } catch (error) {
        continue; // Skip if can't stat
      }
      
      if (!stats.isDirectory()) {
        continue;
      }
      
      const metadata = await readTemplateMetadata(entryPath);
      if (metadata) {
        // Apply type if not present
        if (!metadata.type) {
          metadata.type = type;
        }
        templates.push(metadata);
      }
    }
    
    return templates;
  } catch (error) {
    console.error(`Error discovering templates in ${dirPath}:`, error);
    return [];
  }
}

/**
 * Build the complete template registry
 * 
 * @param {boolean} refresh - Force refresh the registry
 * @returns {Promise<Object>} The template registry object
 */
export async function readTemplateRegistry(refresh = false) {
  // Return cached registry if available and not forced to refresh
  if (templateRegistry && !refresh) {
    return templateRegistry;
  }
  
  // Build the registry
  const registry = {
    templates: [],
    byName: {},
    byType: {},
    byTag: {}
  };
  
  // Discover templates for each type
  for (const [type, dirPath] of Object.entries(BASE_TEMPLATE_PATHS)) {
    const templates = await discoverTemplates(dirPath, type);
    registry.templates.push(...templates);
  }
  
  // Build indexes
  registry.templates.forEach(template => {
    // Index by name
    registry.byName[template.name] = template;
    
    // Index by type
    if (!registry.byType[template.type]) {
      registry.byType[template.type] = [];
    }
    registry.byType[template.type].push(template);
    
    // Index by tags
    if (template.tags && Array.isArray(template.tags)) {
      template.tags.forEach(tag => {
        if (!registry.byTag[tag]) {
          registry.byTag[tag] = [];
        }
        registry.byTag[tag].push(template);
      });
    }
  });
  
  // Update the cache
  templateRegistry = registry;
  
  return registry;
}

/**
 * Get a template by name
 * 
 * @param {string} name - Name of the template
 * @param {boolean} refresh - Force refresh the registry
 * @param {boolean} resolveInheritance - Whether to resolve template inheritance
 * @returns {Promise<Object|null>} Template object or null if not found
 */
export async function getTemplateByName(name, refresh = false, resolveInheritance = false) {
  const registry = await readTemplateRegistry(refresh);
  const template = registry.byName[name] || null;
  
  // Return null if template not found
  if (!template) {
    return null;
  }
  
  // Return template without resolving inheritance if not requested
  if (!resolveInheritance) {
    return template;
  }
  
  // Resolve template inheritance
  return resolveTemplateInheritance(template);
}

/**
 * List templates with optional filtering
 * 
 * @param {Object} options - Filter options
 * @param {string} options.type - Filter by template type
 * @param {string} options.tag - Filter by template tag
 * @param {string} options.search - Search term to filter by
 * @param {boolean} options.refresh - Force refresh the registry
 * @returns {Promise<Object[]>} Array of matching templates
 */
export async function listTemplates(options = {}) {
  const { type, tag, search, refresh = false } = options;
  const registry = await readTemplateRegistry(refresh);
  
  let templates = registry.templates;
  
  // Filter by type
  if (type && registry.byType[type]) {
    templates = registry.byType[type];
  }
  
  // Filter by tag
  if (tag && registry.byTag[tag]) {
    templates = templates.filter(template => 
      registry.byTag[tag].some(t => t.name === template.name)
    );
  }
  
  // Filter by search term
  if (search) {
    const searchTerm = search.toLowerCase();
    templates = templates.filter(template => {
      // Search in name, displayName, description
      const nameMatch = template.name?.toLowerCase().includes(searchTerm);
      const displayNameMatch = template.displayName?.toLowerCase().includes(searchTerm);
      const descriptionMatch = template.description?.toLowerCase().includes(searchTerm);
      
      // Search in tags
      const tagsMatch = template.tags?.some(tag => tag.toLowerCase().includes(searchTerm)) || false;
      
      return nameMatch || displayNameMatch || descriptionMatch || tagsMatch;
    });
  }
  
  return templates;
}

/**
 * Register a custom template from a directory
 * 
 * @param {string} templateDir - Path to the template directory
 * @returns {Promise<Object>} The registered template object
 */
export async function registerCustomTemplate(templateDir) {
  // Ensure custom templates directory exists
  if (!fs.existsSync(BASE_TEMPLATE_PATHS.custom)) {
    await mkdirAsync(BASE_TEMPLATE_PATHS.custom, { recursive: true });
  }
  
  // Verify the template directory and metadata
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template directory not found: ${templateDir}`);
  }
  
  const metadata = await readTemplateMetadata(templateDir);
  if (!metadata) {
    throw new Error(`Invalid template: missing or invalid template.json`);
  }
  
  // Force refresh registry to include the new template
  try {
    await readTemplateRegistry(true);
    return metadata;
  } catch (error) {
    throw new Error(`Failed to register custom template: ${error.message}`);
  }
}

/**
 * Register a template directly
 * 
 * @param {Object} template - Template object to register
 * @returns {Promise<Object>} The registered template
 */
export async function registerTemplate(template) {
  try {
    // Validate the template
    validateTemplate(template);
    
    // Force registry refresh
    const registry = await readTemplateRegistry(true);
    
    // Add to registry
    registry.templates.push(template);
    registry.byName[template.name] = template;
    
    if (!registry.byType[template.type]) {
      registry.byType[template.type] = [];
    }
    registry.byType[template.type].push(template);
    
    if (template.tags && Array.isArray(template.tags)) {
      template.tags.forEach(tag => {
        if (!registry.byTag[tag]) {
          registry.byTag[tag] = [];
        }
        registry.byTag[tag].push(template);
      });
    }
    
    return template;
  } catch (error) {
    throw new Error(`Failed to register template: ${error.message}`);
  }
}

/**
 * Resolve template inheritance chain
 * 
 * @param {Object} template - Template object to resolve
 * @param {Set<string>} visited - Set of already visited templates (to prevent circular inheritance)
 * @returns {Promise<Object>} Resolved template with inheritance applied
 */
export async function resolveTemplateInheritance(template, visited = new Set()) {
  // Base case: no inheritance
  if (!template.extends) {
    return template;
  }
  
  // Check for circular inheritance
  if (visited.has(template.name)) {
    console.warn(`Circular inheritance detected for template '${template.name}'`);
    return template;
  }
  
  // Add this template to visited set
  visited.add(template.name);
  
  // Get parent template without resolving its inheritance yet
  const parentTemplate = await getTemplateByName(template.extends, false, false);
  if (!parentTemplate) {
    console.warn(`Parent template '${template.extends}' not found for '${template.name}'`);
    return template;
  }
  
  // Recursively resolve parent inheritance
  const resolvedParent = await resolveTemplateInheritance(parentTemplate, visited);
  
  // Merge templates (parent first, then child overrides)
  const merged = {
    ...resolvedParent,
    ...template,
    
    // Special merging for object properties
    variables: { ...resolvedParent.variables, ...template.variables },
    dependencies: [...new Set([...(resolvedParent.dependencies || []), ...(template.dependencies || [])])],
    devDependencies: [...new Set([...(resolvedParent.devDependencies || []), ...(template.devDependencies || [])])],
    tags: [...new Set([...(resolvedParent.tags || []), ...(template.tags || [])])],
    
    // Special handling for files
    files: mergeFiles(resolvedParent.files, template.files),
    conditionalFiles: mergeConditionalFiles(resolvedParent.conditionalFiles, template.conditionalFiles),
    
    // Merge postInit actions
    postInit: [...(resolvedParent.postInit || []), ...(template.postInit || [])],
    
    // Merge environment variables
    envVars: { ...resolvedParent.envVars, ...template.envVars },
    
    // Merge package.json configuration
    packageJson: mergePackageJsonConfig(resolvedParent.packageJson, template.packageJson),
    
    // Handle project manifest inheritance
    projectManifest: mergeProjectManifest(resolvedParent.projectManifest, template.projectManifest),
    
    // Preserve original extends property
    extends: template.extends,
    
    // Mark as resolved
    _resolved: true,
    _resolvedFrom: [resolvedParent.name, ...(resolvedParent._resolvedFrom || [])]
  };
  
  return merged;
}

/**
 * Merge file lists from parent and child templates
 * 
 * @param {Array<string>} parentFiles - Files from parent template
 * @param {Array<string>} childFiles - Files from child template
 * @returns {Array<string>} Merged file list
 */
function mergeFiles(parentFiles = [], childFiles = []) {
  /**
   * A file entry is either a plain string path or a
   * `{ source, destination, template }` object. Every template that ships in
   * this repo uses the object form, so assuming strings made inheritance throw
   * `file.startsWith is not a function` for all of them.
   *
   * @param {string|Object} file - File entry
   * @returns {string} A stable identity for deduplication
   */
  const identityOf = (file) =>
    typeof file === 'string' ? file : (file?.destination ?? file?.source ?? '');

  /**
   * @param {string|Object} file - File entry
   * @returns {boolean} True if the entry excludes an inherited file
   */
  const isExclusion = (file) => typeof file === 'string' && file.startsWith('!');

  // Get exclusions from child (string entries starting with !)
  const exclusions = (childFiles || [])
    .filter(isExclusion)
    .map(file => file.substring(1));
  
  // Start with parent files not excluded
  const result = (parentFiles || [])
    .filter(file => !exclusions.includes(identityOf(file)));
  
  // Add non-exclusion child files, overriding a parent entry with the same target
  (childFiles || [])
    .filter(file => !isExclusion(file))
    .forEach(file => {
      const identity = identityOf(file);
      const existingIndex = result.findIndex(existing => identityOf(existing) === identity);
      if (existingIndex >= 0) {
        result[existingIndex] = file;
      } else {
        result.push(file);
      }
    });
  
  return result;
}

/**
 * Merge conditional files from parent and child templates
 * 
 * @param {Object} parentConditionalFiles - Conditional files from parent template
 * @param {Object} childConditionalFiles - Conditional files from child template
 * @returns {Object} Merged conditional files
 */
function mergeConditionalFiles(parentConditionalFiles = {}, childConditionalFiles = {}) {
  const result = { ...parentConditionalFiles };
  
  // Merge child conditional files
  Object.entries(childConditionalFiles || {}).forEach(([condition, files]) => {
    if (!result[condition]) {
      result[condition] = [];
    }
    
    // Process exclusions
    const exclusions = files
      .filter(file => file.startsWith('!'))
      .map(file => file.substring(1));
    
    // Remove excluded files
    result[condition] = result[condition]
      .filter(file => !exclusions.includes(file));
    
    // Add new files
    files
      .filter(file => !file.startsWith('!'))
      .forEach(file => {
        if (!result[condition].includes(file)) {
          result[condition].push(file);
        }
      });
  });
  
  return result;
}

/**
 * Merge project manifests from parent and child templates
 * 
 * @param {Object} parentManifest - Project manifest from parent template
 * @param {Object} childManifest - Project manifest from child template
 * @returns {Object} Merged project manifest
 */
export function mergeProjectManifest(parentManifest, childManifest) {
  // If either is missing, return the other
  if (!parentManifest) return childManifest;
  if (!childManifest) return parentManifest;
  
  // Start with a deep copy of parent
  const result = JSON.parse(JSON.stringify(parentManifest));
  
  // Merge every top-level property the child defines, not just the three that
  // used to be handled by name. Any other field a child manifest declared
  // (author, license, scripts, ...) was previously dropped on the floor.
  // Keys with structural merges of their own are handled below.
  const STRUCTURALLY_MERGED_KEYS = new Set(['components', 'kvStore', 'linkages', 'deployment']);
  for (const [key, value] of Object.entries(childManifest)) {
    if (STRUCTURALLY_MERGED_KEYS.has(key)) continue;
    if (value === undefined) continue;
    result[key] = value;
  }
  
  // Merge components
  if (childManifest.components) {
    if (!result.components) result.components = {};
    
    // Merge functions
    if (childManifest.components.functions) {
      if (!result.components.functions) result.components.functions = [];
      
      // Merge by name
      childManifest.components.functions.forEach(childFunc => {
        const existingIndex = result.components.functions.findIndex(f => f.name === childFunc.name);
        if (existingIndex >= 0) {
          // Update existing function
          result.components.functions[existingIndex] = {
            ...result.components.functions[existingIndex],
            ...childFunc
          };
        } else {
          // Add new function
          result.components.functions.push(childFunc);
        }
      });
    }
    
    // Merge applets
    if (childManifest.components.applets) {
      if (!result.components.applets) result.components.applets = [];
      
      // Merge by name
      childManifest.components.applets.forEach(childApplet => {
        const existingIndex = result.components.applets.findIndex(a => a.name === childApplet.name);
        if (existingIndex >= 0) {
          // Update existing applet
          result.components.applets[existingIndex] = {
            ...result.components.applets[existingIndex],
            ...childApplet
          };
        } else {
          // Add new applet
          result.components.applets.push(childApplet);
        }
      });
    }
  }
  
  // Merge KV store namespaces
  if (childManifest.kvStore) {
    if (!result.kvStore) result.kvStore = {};
    
    if (childManifest.kvStore.namespaces) {
      if (!result.kvStore.namespaces) result.kvStore.namespaces = [];
      
      // Merge by name
      childManifest.kvStore.namespaces.forEach(childNs => {
        const existingIndex = result.kvStore.namespaces.findIndex(ns => ns.name === childNs.name);
        if (existingIndex >= 0) {
          // Update existing namespace
          result.kvStore.namespaces[existingIndex] = {
            ...result.kvStore.namespaces[existingIndex],
            ...childNs
          };
        } else {
          // Add new namespace
          result.kvStore.namespaces.push(childNs);
        }
      });
    }
  }
  
  // Merge linkages
  if (childManifest.linkages) {
    if (!result.linkages) result.linkages = [];
    
    // No easy way to merge linkages, just append child linkages
    childManifest.linkages.forEach(linkage => {
      // Check if linkage already exists
      const existsLinkage = result.linkages.some(
        l => l.from === linkage.from && l.to === linkage.to
      );
      
      if (!existsLinkage) {
        result.linkages.push(linkage);
      }
    });
  }
  
  // Merge deployment settings
  if (childManifest.deployment) {
    result.deployment = {
      ...result.deployment,
      ...childManifest.deployment
    };
  }
  
  return result;
}

/**
 * Merge package.json configuration objects
 * 
 * @param {Object} parentConfig - Package configuration from parent template
 * @param {Object} childConfig - Package configuration from child template
 * @returns {Object} Merged package configuration
 */
function mergePackageJsonConfig(parentConfig, childConfig) {
  // If either is missing, return the other
  if (!parentConfig) return childConfig;
  if (!childConfig) return parentConfig;
  
  // Start with a deep copy of parent
  const result = JSON.parse(JSON.stringify(parentConfig));
  
  // Handle inheritance
  if (childConfig.inherits && !result.inherits) {
    result.inherits = childConfig.inherits;
  }
  
  // Merge components arrays
  if (childConfig.components) {
    if (!result.components) result.components = [];
    result.components = [...new Set([...result.components, ...childConfig.components])];
  }
  
  // Merge customizations objects
  if (childConfig.customizations) {
    if (!result.customizations) result.customizations = {};
    result.customizations = packageTemplateManager.mergePackageJson(
      result.customizations, 
      childConfig.customizations
    );
  }
  
  // Child disabled flag takes precedence
  if (childConfig.disabled !== undefined) {
    result.disabled = childConfig.disabled;
  }
  
  return result;
}

export default {
  readTemplateMetadata,
  discoverTemplates,
  readTemplateRegistry,
  getTemplateByName,
  listTemplates,
  registerCustomTemplate,
  registerTemplate,
  resolveTemplateInheritance,
  validateTemplate,
  mergeProjectManifest,
  mergePackageJsonConfig,
  BASE_TEMPLATE_PATHS
};