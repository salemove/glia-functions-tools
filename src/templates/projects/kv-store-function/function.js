/**
 * {{projectName}}
 * 
 * {{description}}
 * 
 * This function demonstrates the use of KV Store in Glia Functions
 * for persistent data storage across function invocations.
 */

import { processRequest, handleError } from './lib/kv-operations.js';

/**
 * Main function entry point
 * 
 * @param {Request} request - The HTTP request object
 * @param {Object} env - Environment variables
 * @param {Object} kvStoreFactory - KV Store factory for creating KV Store instances
 * @returns {Response} - HTTP response
 */
export async function onInvoke(request, env, kvStoreFactory) {
  // Initialize KV Store with namespace from environment or default
  const namespace = env.KV_NAMESPACE || '{{namespace}}';
  const kvStore = kvStoreFactory.initializeKvStore(namespace);
  
  try {
    // Process the request based on method and path
    return await processRequest(request, kvStore, env);
  } catch (error) {
    // Handle any errors that occur during processing
    return handleError(error);
  }
}

/**
 * Optional healthcheck function
 * Called periodically to ensure function is healthy
 * 
 * @param {Object} env - Environment variables
 * @param {Object} kvStoreFactory - KV Store factory
 * @returns {Object} - Health status
 */
export async function onHealthCheck(env, kvStoreFactory) {
  try {
    // Initialize KV Store with namespace
    const namespace = env.KV_NAMESPACE || '{{namespace}}';
    const kvStore = kvStoreFactory.initializeKvStore(namespace);
    
    // Perform a simple operation to verify KV Store is working
    const testKey = '_healthcheck_' + Date.now();
    await kvStore.set({ key: testKey, value: 'ok' });
    const result = await kvStore.get(testKey);
    
    // Clean up the test key
    await kvStore.delete(testKey);
    
    return { 
      status: 'healthy',
      kvStoreCheck: result && result.value === 'ok' ? 'ok' : 'failed'
    };
  } catch (error) {
    return { 
      status: 'unhealthy',
      error: error.message
    };
  }
}