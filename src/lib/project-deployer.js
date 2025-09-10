/**
 * Project deployer
 * 
 * This module handles the deployment of complete projects,
 * including functions, applets, and KV store data.
 */

import fs from 'fs/promises';
import path from 'path';
import GliaApiClient from './api.js';
import { getApiConfig } from './config.js';
import { ValidationError } from './errors.js';
import { 
  validateProjectManifest, 
  validateComponentFiles,
  validateKvNamespaceReferences 
} from './project-validator.js';
import { processLinkages } from './project-linkage-processor.js';

/**
 * Deployment state tracking class
 * Records all changes made during deployment for rollback
 */
export class DeploymentState {
  constructor() {
    this.deployedFunctions = [];
    this.deployedFunctionVersions = [];
    this.deployedFunctionDeployments = [];
    this.deployedApplets = [];
    this.populatedKvPairs = [];
  }

  addFunction(id, name) {
    this.deployedFunctions.push({ id, name });
    return this;
  }

  addFunctionVersion(functionId, versionId) {
    this.deployedFunctionVersions.push({ functionId, versionId });
    return this;
  }

  addFunctionDeployment(functionId, versionId) {
    this.deployedFunctionDeployments.push({ functionId, versionId });
    return this;
  }

  addApplet(id, name) {
    this.deployedApplets.push({ id, name });
    return this;
  }

  addKvPair(namespace, key, originalValue) {
    this.populatedKvPairs.push({ namespace, key, originalValue });
    return this;
  }

  hasDeployedResources() {
    return (
      this.deployedFunctions.length > 0 ||
      this.deployedApplets.length > 0 ||
      this.populatedKvPairs.length > 0
    );
  }

  getSummary() {
    return {
      functions: this.deployedFunctions.length,
      functionVersions: this.deployedFunctionVersions.length,
      functionDeployments: this.deployedFunctionDeployments.length,
      applets: this.deployedApplets.length,
      kvPairs: this.populatedKvPairs.length
    };
  }
}

/**
 * Deploy a project from a manifest file
 * 
 * @param {string} manifestPath - Path to the manifest file
 * @param {Object} options - Deployment options
 * @param {boolean} [options.dryRun=false] - Only validate, don't deploy
 * @param {boolean} [options.skipKvData=false] - Skip populating KV store data
 * @param {boolean} [options.skipFunctions=false] - Skip function deployment
 * @param {boolean} [options.skipApplets=false] - Skip applet deployment
 * @param {boolean} [options.rollbackOnFailure=true] - Rollback on failure
 * @param {Function} [options.logger] - Logger function
 * @returns {Promise<Object>} - Deployment results
 */
export async function deployProject(manifestPath, options = {}) {
  const state = new DeploymentState();
  const logger = options.logger || console.log;
  const projectRoot = path.dirname(path.resolve(manifestPath));
  
  // Initialize API client outside try/catch for proper scope access
  let api;
  
  try {
    // Load and validate manifest
    logger('Loading project manifest...');
    const manifest = await loadManifest(manifestPath);
    
    // Validate manifest structure
    logger('Validating project manifest...');
    await validateProjectManifest(manifest);
    
    // Validate component files
    logger('Validating component files...');
    await validateComponentFiles(manifest, projectRoot);
    
    // Validate KV namespace references
    logger('Validating KV namespace references...');
    await validateKvNamespaceReferences(manifest);
    
    // If dry run, stop here
    if (options.dryRun) {
      logger('Dry run completed. Manifest is valid.');
      return {
        success: true,
        dryRun: true,
        manifest
      };
    }
    
    // Initialize API client
    api = new GliaApiClient(await getApiConfig());
    
    // Deploy components
    const deployedFunctions = {};
    
    // Deploy functions if not skipped
    if (!options.skipFunctions && manifest.components?.functions?.length > 0) {
      logger('Deploying functions...');
      Object.assign(
        deployedFunctions, 
        await deployFunctions(manifest.components.functions, api, state, projectRoot, logger)
      );
    }
    
    // Populate KV data if not skipped
    if (!options.skipKvData && manifest.kvStore?.namespaces?.length > 0) {
      logger('Populating KV store data...');
      await populateKvData(manifest.kvStore.namespaces, api, state, logger);
    }
    
    // Deploy applets if not skipped
    if (!options.skipApplets && manifest.components?.applets?.length > 0) {
      logger('Processing applet linkages...');
      const processedApplets = await processLinkages(manifest, deployedFunctions, projectRoot);
      
      logger('Deploying applets...');
      await deployApplets(processedApplets, api, state, logger);
    }
    
    // Cleanup API resources to allow process to exit cleanly
    if (api.networkDetector) {
      api.networkDetector.stopChecking();
    }
    
    if (api.offlineManager && api.offlineManager.networkDetector) {
      api.offlineManager.networkDetector.stopChecking();
    }
    
    // Clear any active request timers
    api.activeRequests.forEach((controller) => {
      controller.abort();
    });
    
    // Deployment successful
    logger('Project deployment completed successfully!');
    return {
      success: true,
      deploymentState: state.getSummary(),
      deployedFunctions
    };
    
  } catch (error) {
    // Handle rollback if enabled and resources were deployed
    if (options.rollbackOnFailure !== false && state.hasDeployedResources()) {
      logger('Deployment failed, rolling back...');
      await performRollback(state, await getApiConfig(), logger);
    }
    
    // Cleanup API resources to allow process to exit cleanly
    if (api && api.offlineManager && api.offlineManager.networkDetector) {
      api.offlineManager.networkDetector.stopChecking();
    }
    
    if (api && api.activeRequests) {
      api.activeRequests.forEach((controller) => {
        controller.abort();
      });
    }
    
    // Rethrow the error
    throw error;
  }
}

/**
 * Load a project manifest file
 * 
 * @param {string} manifestPath - Path to the manifest file
 * @returns {Promise<Object>} - Parsed manifest object
 */
async function loadManifest(manifestPath) {
  try {
    const content = await fs.readFile(manifestPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ValidationError(`Manifest file not found: ${manifestPath}`);
    }
    
    if (error instanceof SyntaxError) {
      throw new ValidationError(`Invalid JSON in manifest file: ${error.message}`);
    }
    
    throw error;
  }
}

/**
 * Deploy functions defined in the project
 * 
 * @param {Array<Object>} functions - Function definitions
 * @param {GliaApiClient} api - API client
 * @param {DeploymentState} state - Deployment state tracker
 * @param {string} projectRoot - Project root directory
 * @param {Function} logger - Logger function
 * @returns {Promise<Object>} - Map of function names to deployment details
 */
async function deployFunctions(functions, api, state, projectRoot, logger) {
  const deployedFunctions = {};
  
  for (const func of functions) {
    logger(`Deploying function: ${func.name}`);
    
    // Read function code
    const filePath = path.resolve(projectRoot, func.path);
    const code = await fs.readFile(filePath, 'utf8');
    
    // Prepare environment variables with KV namespace config
    const envVars = { ...func.environmentVariables } || {};
    
    // Add KV namespace config if specified
    if (func.kvStore && Array.isArray(func.kvStore.namespaces)) {
      // Map namespace names for the function
      envVars.KV_NAMESPACES = JSON.stringify(func.kvStore.namespaces);
      
      // Note: KV store permissions are not currently supported by the platform
      // Keeping deployment code commented out for potential future implementation
      /*
      if (Array.isArray(func.kvStore.permissions)) {
        envVars.KV_PERMISSIONS = JSON.stringify(func.kvStore.permissions);
      }
      */
    }
    
    // Create or find function
    let functionId;
    let isNew = false;
    
    try {
      // Try to find existing function
      const functionsList = await api.listFunctions();
      const existingFunction = functionsList.functions.find(f => f.name === func.name);
      
      if (existingFunction) {
        logger(`Found existing function: ${func.name} (${existingFunction.id})`);
        functionId = existingFunction.id;
      } else {
        // Create new function
        logger(`Creating new function: ${func.name}`);
        const newFunction = await api.createFunction(func.name, func.description || '');
        functionId = newFunction.id;
        state.addFunction(functionId, func.name);
        isNew = true;
      }
    } catch (error) {
      throw new Error(`Failed to create/find function ${func.name}: ${error.message}`);
    }
    
    // Create new version
    logger(`Creating version for function: ${func.name}`);
    try {
      const versionOptions = {
        environmentVariables: envVars
      };
      
      if (func.compatibilityDate) {
        versionOptions.compatibilityDate = func.compatibilityDate;
      }
      
      const versionTask = await api.createVersion(functionId, code, versionOptions);
      
      // Wait for version creation task to complete
      // Extract task ID from the response - either from self URL or from a header
      let taskId;
      
      if (versionTask && versionTask.self) {
        taskId = versionTask.self.split('/').pop();
        logger(`Task ID extracted from self URL: ${taskId}`);
      } else {
        // If we don't have a self link, this might be due to a redirect
        // In this case, we need to try to extract the ID another way
        logger('No self URL found in task response, checking for alternate task ID sources');
        
        if (versionTask && versionTask.id) {
          taskId = versionTask.id;
          logger(`Task ID extracted from id field: ${taskId}`);
        } else {
          throw new Error(`Could not extract task ID from version creation response: ${JSON.stringify(versionTask)}`);
        }
      }
      
      // Poll for task completion
      let taskResult;
      let attempts = 0;
      const maxAttempts = 180; // 3 minutes (polling every second)
      
      // Special handling for initial task result
      // In some cases, the API might respond with a 303 redirect that already contains the task result
      // Check if versionTask itself is the task result
      if (versionTask && typeof versionTask.status === 'string') {
        logger('Task response already contains status information, using it directly');
        taskResult = versionTask;
        
        // Detailed logging of task result
        logger(`Task result: ${JSON.stringify(taskResult)}`);
        
        // If task is already complete, handle it immediately
        if (taskResult.status === 'completed') {
          logger(`Task already completed with status: ${taskResult.status}`);
          
          // Try to find the version ID from multiple possible locations
          let versionId = null;
          
          // Check entity.id first (most common)
          if (taskResult.entity && taskResult.entity.id) {
            versionId = taskResult.entity.id;
            logger(`Version ID found in entity.id: ${versionId}`);
          }
          // Check entity.href for ID extraction
          else if (taskResult.entity && taskResult.entity.href) {
            const match = taskResult.entity.href.match(/\/versions\/([^\/]+)/);
            if (match && match[1]) {
              versionId = match[1];
              logger(`Version ID extracted from entity.href: ${versionId}`);
            }
          }
          // Last resort - check for ID in any field that might contain it
          else {
            logger('No direct version ID found, searching response for version ID');
            // Look through all fields recursively for something that looks like a version ID
            const findVersionId = (obj, path = '') => {
              if (!obj || typeof obj !== 'object') return null;
              
              for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                
                // If this is an ID-looking string
                if (typeof value === 'string' && 
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) &&
                    key.toLowerCase().includes('id') && 
                    !currentPath.includes('task') && 
                    !currentPath.includes('function')) {
                  logger(`Possible version ID found in ${currentPath}: ${value}`);
                  return value;
                }
                
                // Recurse into nested objects
                if (typeof value === 'object' && value !== null) {
                  const nestedId = findVersionId(value, currentPath);
                  if (nestedId) return nestedId;
                }
              }
              
              return null;
            };
            
            versionId = findVersionId(taskResult);
          }
          
          if (versionId) {
            state.addFunctionVersion(functionId, versionId);
            
            // Deploy the version
            logger(`Deploying version for function: ${func.name}`);
            const deployment = await api.deployVersion(functionId, versionId);
            state.addFunctionDeployment(functionId, versionId);
            
            // Store deployment info
            deployedFunctions[func.name] = {
              id: functionId,
              name: func.name,
              versionId,
              invocation_uri: normalizeInvocationUri(deployment.invocation_uri, logger),
              isNew
            };
            
            logger(`Successfully deployed function: ${func.name}`);
            continue; // Continue to next function
          } else {
            logger('Could not find version ID in completed task response, falling back to polling');
          }
        } else if (taskResult.status === 'failed') {
          throw new Error(`Function version creation failed: ${taskResult.error || 'Unknown error'}`);
        }
      }
      
      while (attempts < maxAttempts) {
        taskResult = await api.getVersionCreationTask(functionId, taskId);
        
        if (taskResult.status === 'completed') {
          break;
        } else if (taskResult.status === 'failed') {
          throw new Error(`Function version creation failed: ${taskResult.error || 'Unknown error'}`);
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error(`Timeout waiting for function version creation to complete (after 3 minutes)`);
      }
      
      const versionId = taskResult.entity.id;
      state.addFunctionVersion(functionId, versionId);
      
      // Deploy the version
      logger(`Deploying version for function: ${func.name}`);
      const deployment = await api.deployVersion(functionId, versionId);
      state.addFunctionDeployment(functionId, versionId);
      
      // Store deployment info
      deployedFunctions[func.name] = {
        id: functionId,
        name: func.name,
        versionId,
        invocation_uri: normalizeInvocationUri(deployment.invocation_uri, logger),
        isNew
      };
      
      logger(`Successfully deployed function: ${func.name}`);
      
    } catch (error) {
      throw new Error(`Failed to create/deploy version for function ${func.name}: ${error.message}`);
    }
  }
  
  return deployedFunctions;
}

/**
 * Populate KV store data from manifest
 * 
 * Note: Initial data population is not directly supported by the platform.
 * This function is kept as a placeholder for potential future implementation.
 * 
 * @param {Array<Object>} namespaces - KV namespace definitions
 * @param {GliaApiClient} api - API client
 * @param {DeploymentState} state - Deployment state tracker
 * @param {Function} logger - Logger function
 * @returns {Promise<void>}
 */
async function populateKvData(namespaces, api, state, logger) {
  // The initial data population functionality has been removed as it's not supported by the platform
  logger('KV store setup complete');
  
  // Note: Original implementation commented out below for potential future use
  /*
  for (const namespace of namespaces) {
    if (!namespace.initialData || namespace.initialData.length === 0) {
      continue;
    }
    
    logger(`Setting up KV namespace: ${namespace.name}`);
    
    // Check for existing data first
    try {
      const existingData = await api.listKvPairs(namespace.name, { fetchAll: true });
      const existingKeys = new Map();
      
      if (existingData && existingData.items) {
        existingData.items.forEach(item => {
          existingKeys.set(item.key, item.value);
        });
      }
      
      // Process each initial data item
      for (const item of namespace.initialData) {
        // Check if key already exists
        if (existingKeys.has(item.key)) {
          logger(`Key already exists: ${namespace.name}.${item.key} (skipping)`);
          continue;
        }
        
        // Set the value
        await api.setKvValue(namespace.name, item.key, item.value);
        state.addKvPair(namespace.name, item.key);
        logger(`Set KV value: ${namespace.name}.${item.key}`);
      }
    } catch (error) {
      throw new Error(`Failed to populate KV namespace ${namespace.name}: ${error.message}`);
    }
  }
  */
}

/**
 * Deploy applets with processed linkages
 * 
 * @param {Array<Object>} applets - Processed applet definitions
 * @param {GliaApiClient} api - API client
 * @param {DeploymentState} state - Deployment state tracker
 * @param {Function} logger - Logger function
 * @returns {Promise<void>}
 */
async function deployApplets(applets, api, state, logger) {
  const apiConfig = await getApiConfig();
  
  // First, fetch existing applets to check if we should update or create
  logger('Checking for existing applets...');
  let existingApplets = [];
  try {
    const response = await api.listApplets();
    existingApplets = response.axons || [];
    logger(`Found ${existingApplets.length} existing applets.`);
  } catch (error) {
    logger(`Warning: Failed to fetch existing applets: ${error.message}`);
    logger('Will create new applets instead of updating.');
  }

  for (const applet of applets) {
    // Check if this applet already exists by name
    const existingApplet = existingApplets.find(a => a.name === applet.name);
    
    try {
      const appletOptions = {
        name: applet.name,
        description: applet.description || '',
        ownerSiteId: apiConfig.siteId,
        source: applet.processedSource,
        scope: applet.scope || 'engagement'
      };
      
      let result;
      if (existingApplet) {
        // Update existing applet
        logger(`Updating existing applet: ${applet.name} (${existingApplet.id})`);
        result = await api.updateApplet(existingApplet.id, appletOptions);
        state.addApplet(existingApplet.id, applet.name);
        logger(`Successfully updated applet: ${applet.name} (${existingApplet.id})`);
      } else {
        // Create new applet
        logger(`Creating new applet: ${applet.name}`);
        result = await api.createApplet(appletOptions);
        state.addApplet(result.id, applet.name);
        
        // Add the new applet to the site
        logger(`Adding applet to site: ${applet.name} (${result.id})`);
        await api.addAppletToSite(apiConfig.siteId, result.id);
        
        logger(`Successfully created applet: ${applet.name} (${result.id})`);
      }
    } catch (error) {
      throw new Error(`Failed to deploy applet ${applet.name}: ${error.message}`);
    }
  }
}

/**
 * Perform rollback of deployed resources
 * 
 * @param {DeploymentState} state - Deployment state tracker
 * @param {Object} apiConfig - API configuration
 * @param {Function} logger - Logger function
 * @returns {Promise<void>}
 */
/**
 * Normalize invocation URI format for applet linkages
 * Converts /functions/{id}/invoke to /integrations/{id}/endpoint if needed
 * 
 * @param {string} uri - The invocation URI from API response
 * @param {Function} logger - Logger function
 * @returns {string} - Normalized invocation URI
 */
function normalizeInvocationUri(uri, logger) {
  if (!uri) return uri;
  
  // Check if URI is already in the correct format
  if (uri.includes('/integrations/') && uri.includes('/endpoint')) {
    return uri;
  }
  
  // Convert from /functions/{id}/invoke format to /integrations/{id}/endpoint format
  if (uri.includes('/functions/') && uri.endsWith('/invoke')) {
    try {
      const functionIdFromUri = uri.split('/functions/')[1].split('/invoke')[0];
      const normalizedUri = `/integrations/${functionIdFromUri}/endpoint`;
      logger(`Normalized invocation URI format: ${uri} → ${normalizedUri}`);
      return normalizedUri;
    } catch (error) {
      logger(`Warning: Failed to normalize invocation URI: ${uri}. Using original URI.`);
      return uri;
    }
  }
  
  // Return original URI if no normalization needed or possible
  return uri;
}

async function performRollback(state, apiConfig, logger) {
  const api = new GliaApiClient(apiConfig);
  
  // Rollback applets (delete them)
  for (const applet of state.deployedApplets) {
    try {
      logger(`Rolling back applet: ${applet.name} (${applet.id})`);
      await api.deleteApplet(applet.id);
    } catch (error) {
      logger(`Warning: Failed to roll back applet ${applet.name}: ${error.message}`);
    }
  }
  
  // Rollback KV data (delete keys that were added)
  for (const kvPair of state.populatedKvPairs) {
    try {
      logger(`Rolling back KV pair: ${kvPair.namespace}.${kvPair.key}`);
      await api.deleteKvValue(kvPair.namespace, kvPair.key);
    } catch (error) {
      logger(`Warning: Failed to roll back KV pair ${kvPair.namespace}.${kvPair.key}: ${error.message}`);
    }
  }
  
  // For newly created functions, we won't delete them to avoid unexpected data loss
  // Instead log which functions were created
  if (state.deployedFunctions.length > 0) {
    logger(`Note: The following functions were created but not deleted during rollback:`);
    for (const func of state.deployedFunctions) {
      logger(`  - ${func.name} (${func.id})`);
    }
  }
  
  logger('Rollback completed');
}