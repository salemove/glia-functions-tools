/**
 * {{projectName}}
 * 
 * {{description}}
 * @version {{version}}
 */

// Import utilities
import { validatePayload } from './lib/validation.js';
import { retryWithBackoff } from './lib/retry.js';
import { logger } from './lib/logging.js';

{{#if includeFiltering}}
import { filterSensitiveData } from './lib/filtering.js';
{{/if}}

/**
 * Process Presence Update event from Glia
 * 
 * @param {Object} request - The request object
 * @param {Object} env - Environment variables
 * @returns {Response} The response object
 */
export async function onInvoke(request, env) {
  try {
    // Parse the request payload
    const requestJson = await request.json();
    const data = JSON.parse(requestJson.payload);
    
    // Log the event (with limited data for privacy)
    logger.info('Received presence update event', {
      eventType: 'presence-update',
      operatorId: data.operator_id,
      status: data.status,
      previousStatus: data.previous_status,
      timestamp: new Date().toISOString()
    });
    
    // Detailed debug logging (only enabled when DEBUG=true)
    logger.debug('Event details', {
      operatorId: data.operator_id,
      siteId: data.site_id,
      updatedAt: data.updated_at,
      groupId: data.group?.id,
      timestamp: new Date().toISOString()
    });
    
    // Validate the payload against the schema
    const validationResult = validatePayload(data, 'presence-update');
    if (!validationResult.valid) {
      logger.error('Validation error', validationResult.errors);
      return Response.JSON({
        success: false,
        error: 'Invalid payload format',
        validationErrors: validationResult.errors,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    {{#if includeForwarding}}
    // Forward to external service if configured
    if (env.FORWARDING_URL) {
      try {
        await forwardToExternalService(data, env);
        logger.info('Presence update event forwarded successfully');
      } catch (forwardingError) {
        logger.error('Error forwarding presence update event', { error: forwardingError.message });
        // Continue processing despite forwarding error
      }
    }
    {{/if}}

    // Process the event according to your business logic
    const result = await processPresenceUpdate(data, env);
    
    // Return success response
    return Response.JSON({
      success: true,
      message: 'Presence update event processed successfully',
      operatorId: data.operator_id,
      timestamp: new Date().toISOString(),
      result
    });
    
  } catch (error) {
    // Log the error
    logger.error('Error processing presence update event', { 
      error: error.message,
      stack: error.stack
    });
    
    // Return error response
    return Response.JSON({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Process the presence update event according to your business logic
 * 
 * @param {Object} data - The event data
 * @param {Object} env - Environment variables
 * @returns {Object} Processing result
 */
async function processPresenceUpdate(data, env) {
  // Implement your specific business logic here
  // This function should be customized based on your requirements
  
  logger.debug('Processing presence update event');
  
  // Example: Check if this is a status transition that should be tracked
  const shouldTrackStatusChange = env.TRACK_STATUS_CHANGES === 'true';
  let statusChangeTracked = false;
  
  // Example: Process status change if tracking is enabled
  if (shouldTrackStatusChange && data.status !== data.previous_status) {
    statusChangeTracked = true;
    
    logger.info('Operator status change tracked', {
      operatorId: data.operator_id,
      operatorName: data.operator_name,
      fromStatus: data.previous_status,
      toStatus: data.status,
      timestamp: data.updated_at
    });
    
    // Here you would typically record the status change in your system,
    // update metrics, or perform other tracking logic
  }
  
  // Extract operator availability information
  const operatorInfo = {
    operatorId: data.operator_id,
    operatorName: data.operator_name,
    status: data.status,
    previousStatus: data.previous_status,
    updatedAt: data.updated_at,
    group: data.group ? {
      id: data.group.id,
      name: data.group.name
    } : null,
    capabilities: data.capabilities || {},
    statusNote: data.status_note,
    availability: data.availability ? {
      maxConcurrentEngagements: data.availability.max_concurrent_engagements,
      currentEngagementCount: data.availability.current_engagement_count
    } : null
  };
  
  // Return processing result
  return {
    processed: true,
    statusChangeTracked,
    operatorInfo,
    timestamp: new Date().toISOString()
  };
}

{{#if includeForwarding}}
/**
 * Forward the presence update event to an external service
 * 
 * @param {Object} data - The event data
 * @param {Object} env - Environment variables
 * @returns {Promise<void>}
 */
async function forwardToExternalService(data, env) {
  // Don't proceed if no forwarding URL is configured
  if (!env.FORWARDING_URL) {
    logger.debug('No forwarding URL configured');
    return;
  }
  
  // Prepare headers based on authentication type
  const headers = {
    'Content-Type': 'application/json'
  };
  
  {{#if authType}}
  // Add authentication headers based on configured auth type
  switch('{{authType}}') {
    case 'api-key':
      if (env.API_KEY) {
        headers['X-API-Key'] = env.API_KEY;
      }
      break;
    case 'bearer':
      if (env.API_KEY) {
        headers['Authorization'] = `Bearer ${env.API_KEY}`;
      }
      break;
    case 'basic':
      if (env.API_USERNAME && env.API_PASSWORD) {
        const credentials = Buffer.from(`${env.API_USERNAME}:${env.API_PASSWORD}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      break;
  }
  {{/if}}
  
  // Forward with retry logic
  return retryWithBackoff(async () => {
    const response = await fetch(env.FORWARDING_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        eventType: 'presence-update',
        timestamp: new Date().toISOString(),
        data
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to forward event: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response;
  }, {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 5000
  });
}
{{/if}}