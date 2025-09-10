/**
 * {{projectName}}
 * 
 * {{description}}
 * @version {{version}}
 */

// Import utilities
import { validatePayload, detectEventType } from './lib/validation.js';
import { retryWithBackoff } from './lib/retry.js';
import { logger } from './lib/logging.js';

{{#if includeFiltering}}
import { filterSensitiveData } from './lib/filtering.js';
{{/if}}

/**
 * Process export event from Glia
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
    logger.info('Received {{eventType}} event', {
      eventType: '{{eventType}}',
      timestamp: new Date().toISOString()
    });
    
    // Detailed debug logging (only enabled when DEBUG=true)
    logger.debug('Event details', {
      eventId: data.id,
      eventType: '{{eventType}}',
      timestamp: new Date().toISOString()
    });
    
    // Detect event type and validate the payload against the appropriate schema
    let eventType = '{{eventType}}';
    
    // Auto-detect event type from payload structure if not specified
    if (!eventType || eventType === 'auto') {
      const detectedType = detectEventType(data);
      if (detectedType) {
        eventType = detectedType;
        logger.debug('Auto-detected event type', { eventType });
      } else {
        logger.error('Could not auto-detect event type');
        return Response.JSON({
          success: false,
          error: 'Could not determine event type from payload structure',
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
    }
    
    // Validate the payload against the schema
    const validationResult = validatePayload(data, eventType);
    if (!validationResult.valid) {
      logger.error('Validation error', validationResult.errors);
      return Response.JSON({
        success: false,
        error: 'Invalid payload format',
        validationErrors: validationResult.errors,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    {{#if includeFiltering}}
    // Filter sensitive data if configured
    let processedData = data;
    if (env.FILTER_PII === 'true') {
      logger.debug('Filtering PII data');
      processedData = filterSensitiveData(data);
    }
    {{else}}
    const processedData = data;
    {{/if}}

    {{#if includeForwarding}}
    // Forward to external service if configured
    if (env.FORWARDING_URL) {
      try {
        await forwardToExternalService(processedData, env);
        logger.info('Event forwarded successfully');
      } catch (forwardingError) {
        logger.error('Error forwarding event', { error: forwardingError.message });
        // Continue processing despite forwarding error
      }
    }
    {{/if}}

    // Process the event according to your business logic
    const result = await processEvent(processedData, env);
    
    // Return success response
    const eventId = data.id || data.engagement_id || data.engagement?.id || data.sent_at;
    return Response.JSON({
      success: true,
      message: `${eventType} event processed successfully`,
      eventId,
      timestamp: new Date().toISOString(),
      result
    });
    
  } catch (error) {
    // Log the error
    logger.error('Error processing {{eventType}} event', { 
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
 * Process the event according to your business logic
 * 
 * @param {Object} data - The event data
 * @param {Object} env - Environment variables
 * @returns {Object} Processing result
 */
async function processEvent(data, env) {
  // Implement your specific business logic here
  // This function should be customized based on your requirements
  
  // Determine the event type from the payload structure
  const eventType = detectEventType(data) || '{{eventType}}';
  logger.debug('Processing event', { eventType });
  
  // Process based on event type
  switch (eventType) {
    case 'engagement_start':
      return processEngagementStart(data, env);
    
    case 'engagement':
      return processEngagementEnd(data, env);
    
    case 'engagement_transfer':
      return processEngagementTransfer(data, env);
    
    case 'presence_update':
      return processPresenceUpdate(data, env);
    
    default:
      logger.warn('Unknown event type', { eventType });
      // Default processing for unknown event types
      return {
        processed: true,
        eventType,
        timestamp: new Date().toISOString()
      };
  }
}

/**
 * Process engagement start events
 * 
 * @param {Object} data - The event data
 * @param {Object} env - Environment variables
 * @returns {Object} Processing result
 */
async function processEngagementStart(data, env) {
  logger.info('Processing engagement start event', {
    engagementId: data.engagement_id,
    visitorId: data.visitor?.id
  });
  
  // Implement your engagement start specific logic here
  
  return {
    processed: true,
    eventType: 'engagement_start',
    engagementId: data.engagement_id,
    timestamp: new Date().toISOString()
  };
}

/**
 * Process engagement end events
 * 
 * @param {Object} data - The event data
 * @param {Object} env - Environment variables
 * @returns {Object} Processing result
 */
async function processEngagementEnd(data, env) {
  logger.info('Processing engagement end event', {
    engagementId: data.engagement?.id,
    visitorId: data.visitor?.id
  });
  
  // Implement your engagement end specific logic here
  
  return {
    processed: true,
    eventType: 'engagement_end',
    engagementId: data.engagement?.id,
    timestamp: new Date().toISOString()
  };
}

/**
 * Process engagement transfer events
 * 
 * @param {Object} data - The event data
 * @param {Object} env - Environment variables
 * @returns {Object} Processing result
 */
async function processEngagementTransfer(data, env) {
  logger.info('Processing engagement transfer event', {
    engagementId: data.engagement_id,
    visitorId: data.visitor?.id
  });
  
  // Implement your engagement transfer specific logic here
  
  return {
    processed: true,
    eventType: 'engagement_transfer',
    engagementId: data.engagement_id,
    timestamp: new Date().toISOString()
  };
}

/**
 * Process presence update events
 * 
 * @param {Object} data - The event data
 * @param {Object} env - Environment variables
 * @returns {Object} Processing result
 */
async function processPresenceUpdate(data, env) {
  const userCount = data.events?.length || 0;
  logger.info('Processing presence update event', {
    userCount,
    timestamp: data.sent_at
  });
  
  // Implement your presence update specific logic here
  
  return {
    processed: true,
    eventType: 'presence_update',
    userCount,
    timestamp: new Date().toISOString()
  };
}

{{#if includeForwarding}}
/**
 * Forward the event to an external service
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
        eventType: '{{eventType}}',
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