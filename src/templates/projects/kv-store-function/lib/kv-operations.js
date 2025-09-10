/**
 * KV Store Operations Library
 * 
 * This library provides helper functions for working with KV Store in Glia Functions.
 * It includes request handling, data transformation, and error management.
 */

/**
 * Process incoming HTTP requests and route to appropriate handlers
 * 
 * @param {Request} request - The HTTP request object
 * @param {Object} kvStore - KV Store instance
 * @param {Object} env - Environment variables
 * @returns {Response} - HTTP response
 */
export async function processRequest(request, kvStore, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // Get debug setting from environment
  const debug = env.DEBUG_MODE === 'true';
  
  // Log request if debug mode is enabled
  if (debug) {
    console.log(`Processing ${method} request to ${path}`);
  }
  
  // Determine the operation based on method and path
  if (method === 'GET') {
    if (path.endsWith('/list') || path === '/') {
      return await handleListOperation(kvStore, url, debug);
    } else {
      return await handleGetOperation(kvStore, url, debug);
    }
  } else if (method === 'POST') {
    if (path.endsWith('/batch')) {
      return await handleBatchOperation(kvStore, request, debug);
    } else if (path.endsWith('/test-and-set')) {
      return await handleTestAndSetOperation(kvStore, request, debug);
    } else {
      return await handleSetOperation(kvStore, request, debug);
    }
  } else if (method === 'DELETE') {
    return await handleDeleteOperation(kvStore, url, debug);
  } else if (method === 'OPTIONS') {
    // Handle OPTIONS requests for CORS
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
  
  // Return 405 for unsupported methods
  return Response.json({ error: "Method not allowed" }, { 
    status: 405,
    headers: {
      'Allow': 'GET, POST, DELETE, OPTIONS'
    } 
  });
}

/**
 * Handle listing all values in the KV store
 * 
 * @param {Object} kvStore - KV Store instance
 * @param {URL} url - URL object with query parameters
 * @param {boolean} debug - Debug mode flag
 * @returns {Response} - HTTP response
 */
async function handleListOperation(kvStore, url, debug) {
  try {
    const prefix = url.searchParams.get('prefix') || '';
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    
    if (debug) {
      console.log(`Listing KV values with prefix: "${prefix}", limit: ${limit}`);
    }
    
    // Use list method with optional prefix
    let items = [];
    const options = { prefix };
    
    // Use the async iterator to get all items (with limit)
    const iterator = kvStore.itemsAsyncIterator(options);
    let count = 0;
    
    for await (const item of iterator) {
      if (count >= limit) break;
      
      items.push({
        key: item.key,
        value: item.value,
        expires: item.expires
      });
      
      count++;
    }
    
    // Return the list of items
    return Response.json({
      success: true,
      count: items.length,
      items
    });
  } catch (error) {
    if (debug) {
      console.error('Error listing KV values:', error);
    }
    
    return Response.json({ 
      success: false, 
      error: `Failed to list values: ${error.message}` 
    }, { status: 500 });
  }
}

/**
 * Handle getting a single value from the KV store
 * 
 * @param {Object} kvStore - KV Store instance
 * @param {URL} url - URL object with query parameters
 * @param {boolean} debug - Debug mode flag
 * @returns {Response} - HTTP response
 */
async function handleGetOperation(kvStore, url, debug) {
  try {
    const key = url.searchParams.get('key') || url.pathname.split('/').pop();
    
    if (!key || key === '') {
      return Response.json({ 
        success: false, 
        error: "Missing key parameter" 
      }, { status: 400 });
    }
    
    if (debug) {
      console.log(`Getting KV value for key: "${key}"`);
    }
    
    // Get the value from KV store
    const result = await kvStore.get(key);
    
    if (!result || result.value === null) {
      return Response.json({ 
        success: false, 
        error: "Key not found" 
      }, { status: 404 });
    }
    
    return Response.json({
      success: true,
      key: result.key,
      value: result.value,
      expires: result.expires
    });
  } catch (error) {
    if (debug) {
      console.error('Error getting KV value:', error);
    }
    
    return Response.json({ 
      success: false, 
      error: `Failed to get value: ${error.message}` 
    }, { status: 500 });
  }
}

/**
 * Handle setting a value in the KV store
 * 
 * @param {Object} kvStore - KV Store instance
 * @param {Request} request - HTTP request object
 * @param {boolean} debug - Debug mode flag
 * @returns {Response} - HTTP response
 */
async function handleSetOperation(kvStore, request, debug) {
  try {
    const body = await parseJsonBody(request);
    
    if (!body.key) {
      return Response.json({ 
        success: false, 
        error: "Missing key parameter" 
      }, { status: 400 });
    }
    
    if (body.value === undefined) {
      return Response.json({ 
        success: false, 
        error: "Missing value parameter" 
      }, { status: 400 });
    }
    
    if (debug) {
      console.log(`Setting KV value for key: "${body.key}"`);
    }
    
    // Optional TTL (time-to-live) in seconds
    const options = {};
    if (body.ttl) {
      options.expirationTtl = body.ttl;
    }
    
    // Set the value in KV store
    const result = await kvStore.set({ key: body.key, value: body.value, ...options });
    
    return Response.json({
      success: true,
      key: result.key,
      value: result.value,
      expires: result.expires
    });
  } catch (error) {
    if (debug) {
      console.error('Error setting KV value:', error);
    }
    
    return Response.json({ 
      success: false, 
      error: `Failed to set value: ${error.message}` 
    }, { status: 500 });
  }
}

/**
 * Handle deleting a value from the KV store
 * 
 * @param {Object} kvStore - KV Store instance
 * @param {URL} url - URL object with query parameters
 * @param {boolean} debug - Debug mode flag
 * @returns {Response} - HTTP response
 */
async function handleDeleteOperation(kvStore, url, debug) {
  try {
    const key = url.searchParams.get('key') || url.pathname.split('/').pop();
    
    if (!key || key === '') {
      return Response.json({ 
        success: false, 
        error: "Missing key parameter" 
      }, { status: 400 });
    }
    
    if (debug) {
      console.log(`Deleting KV value for key: "${key}"`);
    }
    
    // Delete the value from KV store
    const result = await kvStore.delete(key);
    
    return Response.json({
      success: true,
      key,
      deleted: true
    });
  } catch (error) {
    if (debug) {
      console.error('Error deleting KV value:', error);
    }
    
    return Response.json({ 
      success: false, 
      error: `Failed to delete value: ${error.message}` 
    }, { status: 500 });
  }
}

/**
 * Handle conditional update with test-and-set operation
 * 
 * @param {Object} kvStore - KV Store instance
 * @param {Request} request - HTTP request object
 * @param {boolean} debug - Debug mode flag
 * @returns {Response} - HTTP response
 */
async function handleTestAndSetOperation(kvStore, request, debug) {
  try {
    const body = await parseJsonBody(request);
    
    // Validate required parameters
    if (!body.key) {
      return Response.json({ 
        success: false, 
        error: "Missing key parameter" 
      }, { status: 400 });
    }
    
    if (body.oldValue === undefined) {
      return Response.json({ 
        success: false, 
        error: "Missing oldValue parameter" 
      }, { status: 400 });
    }
    
    if (body.newValue === undefined) {
      return Response.json({ 
        success: false, 
        error: "Missing newValue parameter" 
      }, { status: 400 });
    }
    
    if (debug) {
      console.log(`Test-and-set operation for key: "${body.key}"`);
    }
    
    // Optional TTL for the new value
    const options = {};
    if (body.ttl) {
      options.expirationTtl = body.ttl;
    }
    
    // Perform test-and-set operation
    const result = await kvStore.testAndSet({
      key: body.key,
      oldValue: body.oldValue,
      newValue: body.newValue,
      ...options
    });
    
    // Check if condition was met
    if (!result || result.value === null) {
      return Response.json({
        success: false,
        conditionMet: false,
        message: "Condition not met, value was not updated"
      });
    }
    
    return Response.json({
      success: true,
      conditionMet: true,
      key: result.key,
      value: result.value,
      expires: result.expires
    });
  } catch (error) {
    if (debug) {
      console.error('Error in test-and-set operation:', error);
    }
    
    return Response.json({ 
      success: false, 
      error: `Failed to perform test-and-set operation: ${error.message}` 
    }, { status: 500 });
  }
}

/**
 * Handle batch operations on the KV store
 * 
 * @param {Object} kvStore - KV Store instance
 * @param {Request} request - HTTP request object
 * @param {boolean} debug - Debug mode flag
 * @returns {Response} - HTTP response
 */
async function handleBatchOperation(kvStore, request, debug) {
  try {
    const body = await parseJsonBody(request);
    
    if (!body.operations || !Array.isArray(body.operations)) {
      return Response.json({ 
        success: false, 
        error: "Missing or invalid operations array" 
      }, { status: 400 });
    }
    
    // Check operation limit (maximum 10 per batch)
    if (body.operations.length > 10) {
      return Response.json({ 
        success: false, 
        error: "Too many operations. Maximum of 10 operations per request." 
      }, { status: 400 });
    }
    
    if (debug) {
      console.log(`Processing batch operation with ${body.operations.length} operations`);
    }
    
    // Process the batch operations
    const results = await kvStore.processBatchOperations(body.operations);
    
    return Response.json({
      success: true,
      results
    });
  } catch (error) {
    if (debug) {
      console.error('Error processing batch operations:', error);
    }
    
    return Response.json({ 
      success: false, 
      error: `Failed to process batch operations: ${error.message}` 
    }, { status: 500 });
  }
}

/**
 * Parse JSON body from HTTP request
 * 
 * @param {Request} request - HTTP request object
 * @returns {Object} - Parsed JSON body or empty object
 */
async function parseJsonBody(request) {
  try {
    if (request.method === 'GET') {
      // Extract query params for GET requests
      const url = new URL(request.url);
      const params = {};
      for (const [key, value] of url.searchParams) {
        params[key] = value;
      }
      return params;
    }
    
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        return await request.json();
      } catch (e) {
        return {};
      }
    }
    
    // Try to extract from invoker payload
    try {
      const invokerBody = await request.json();
      if (invokerBody && invokerBody.payload) {
        // Parse payload if it's a string
        if (typeof invokerBody.payload === 'string') {
          try {
            return JSON.parse(invokerBody.payload);
          } catch (e) {
            return invokerBody.payload;
          }
        }
        // Otherwise return as-is
        return invokerBody.payload;
      }
    } catch (e) {
      // Continue if this fails
    }
    
    return {};
  } catch (e) {
    console.error("Error parsing request body:", e);
    return {};
  }
}

/**
 * Handle errors consistently
 * 
 * @param {Error} error - The error object
 * @returns {Response} - HTTP error response
 */
export function handleError(error) {
  console.error("Error processing request:", error);
  
  // Determine the appropriate status code based on error type
  let status = 500;
  let message = "Internal server error";
  
  if (error.name === 'ValidationError') {
    status = 400;
    message = error.message || "Invalid input";
  } else if (error.name === 'NotFoundError') {
    status = 404;
    message = error.message || "Resource not found";
  } else if (error.name === 'AuthorizationError') {
    status = 403;
    message = error.message || "Not authorized";
  }
  
  return Response.json({
    success: false,
    error: message,
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
  }, { status });
}

/**
 * Format and standardize KV store responses
 * 
 * @param {Object} result - The KV store operation result
 * @returns {Object} - Standardized response
 */
export function formatKvResponse(result) {
  if (!result) return null;
  
  return {
    key: result.key,
    value: result.value,
    expires: result.expires,
    success: true
  };
}