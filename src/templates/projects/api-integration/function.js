/**
 * {{projectName}}
 * 
 * API Integration Function
 * @version {{version}}
 */

import { makeApiRequest } from './lib/api-client.js';
import { validateInput } from './lib/validator.js';

/**
 * Main function handler for API integration
 * 
 * @param {Object} request - The request object
 * @param {Object} env - Environment variables
 * @returns {Response} The response object
 */
export async function onInvoke(request, env) {
    // Parse the request payload
    const requestJson = await request.json();
    const payload = JSON.parse(requestJson.payload);
    
    try {
        // Validate required environment variables
        if (!env.API_KEY) {
            throw new Error('Missing API_KEY environment variable');
        }
        
        const apiUrl = env.API_URL || 'https://api.example.com/v1';
        const timeout = parseInt(env.API_TIMEOUT || '5000', 10);
        
        // Validate input payload
        validateInput(payload);
        
        // Log operation (avoid logging sensitive data)
        console.log(`[{{projectName}}] Processing API request to ${apiUrl}`);
        
        // Make API request
        const apiResponse = await makeApiRequest({
            url: apiUrl,
            method: 'POST',
            apiKey: env.API_KEY,
            payload: {
                query: payload.query,
                limit: payload.limit || 10,
                offset: payload.offset || 0
            },
            timeout
        });
        
        // Return successful response
        return Response.JSON({
            success: true,
            data: apiResponse,
            metadata: {
                timestamp: new Date().toISOString(),
                query: payload.query,
                source: '{{projectName}}'
            }
        });
        
    } catch (error) {
        // Handle errors gracefully
        console.error('[{{projectName}}] Error:', error);
        
        // Determine appropriate status code
        let statusCode = 500;
        if (error.name === 'ValidationError') {
            statusCode = 400;
        } else if (error.name === 'ApiTimeoutError') {
            statusCode = 408;
        } else if (error.name === 'ApiAuthError') {
            statusCode = 401;
        }
        
        return Response.JSON({
            success: false,
            error: error.message,
            errorCode: error.code || 'UNKNOWN_ERROR',
            timestamp: new Date().toISOString()
        }, { status: statusCode });
    }
}