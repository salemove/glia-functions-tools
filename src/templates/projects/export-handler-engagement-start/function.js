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
 * Process Engagement Start event from Glia
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
    logger.info('Received engagement start event', {
      eventType: 'engagement-start',
      engagementId: data.id,
      engagementType: data.engagement_type,
      timestamp: new Date().toISOString()
    });
    
    // Detailed debug logging (only enabled when DEBUG=true)
    logger.debug('Event details', {
      eventId: data.id,
      visitorId: data.visitor_id,
      siteId: data.site_id,
      engagementType: data.engagement_type,
      timestamp: new Date().toISOString()
    });
    
    // Validate the payload against the schema
    const validationResult = validatePayload(data, 'engagement-start');
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
      logger.debug('Filtering PII data from engagement start event');
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
        logger.info('Engagement start event forwarded successfully');
      } catch (forwardingError) {
        logger.error('Error forwarding engagement start event', { error: forwardingError.message });
        // Continue processing despite forwarding error
      }
    }
    {{/if}}

    // Process the event according to your business logic
    const result = await processEngagementStart(processedData, env);
    
    // Return success response
    return Response.JSON({
      success: true,
      message: 'Engagement start event processed successfully',
      engagementId: data.id,
      timestamp: new Date().toISOString(),
      result
    });
    
  } catch (error) {
    // Log the error
    logger.error('Error processing engagement start event', { 
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
 * Process the engagement start event according to your business logic
 * 
 * @param {Object} data - The event data
 * @param {Object} env - Environment variables
 * @returns {Object} Processing result
 */
async function processEngagementStart(data, env) {
  // Implement your specific business logic here
  // This function should be customized based on your requirements
  
  logger.debug('Processing engagement start event');
  
  // Example: Extracting useful information from the engagement
  const engagementInfo = {
    engagementId: data.id,
    engagementType: data.engagement_type,
    startTime: data.created_at,
    context: data.context ? {
      pageUrl: data.context.page_url,
      pageTitle: data.context.page_title,
      queueName: data.context.queue_name
    } : {}
  };
  
  // Example: Process any custom visitor attributes if available
  if (data.visitor && data.visitor.custom_attributes) {
    engagementInfo.customAttributes = data.visitor.custom_attributes;
  }
  
  // Return processing result
  return {
    processed: true,
    engagementInfo,
    timestamp: new Date().toISOString()
  };
}

{{#if includeForwarding}}
/**
 * Forward the engagement start event to an external service
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
        eventType: 'engagement-start',
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