/**
 * {{appletName}} Backend Function
 * {{description}}
 * {{#if authorName}}Author: {{authorName}}{{/if}}
 * 
 * This function serves as the backend for the {{appletName}} applet.
 * It receives data from the frontend, processes it, and returns a response.
 */

/**
 * Main function handler that is invoked when the function is called
 * 
 * @param {Object} request - The request object
 * @param {Object} env - Environment variables
 * @returns {Response} - Response object
 */
export async function onInvoke(request, env) {
    try {
        // Log the incoming request
        console.log('Received request:', request);

        // Parse the request body
        const requestWrapper = await request.json();
        
        // The actual payload is in the 'payload' field as a string
        const payload = JSON.parse(requestWrapper.payload || '{}');
        
        console.log('Parsed payload:', payload);

        // Extract data from the payload
        const { text, number, option, timestamp } = payload;

        // Validate required fields
        if (text === undefined) {
            throw new Error('Text input is required');
        }
        
        if (number === undefined || isNaN(number)) {
            throw new Error('Valid number input is required');
        }

        // Process the data (this is a simple example)
        const processedData = {
            originalText: text,
            processedText: text.toUpperCase(),
            originalNumber: number,
            processedNumber: number * 2,
            selectedOption: option,
            requestTimestamp: timestamp,
            processedTimestamp: new Date().toISOString(),
            // Include any environment variables that are safe to expose
            apiUrl: env.API_URL // This comes from the environment variables
        };

        // Construct the response
        const result = {
            status: 'success',
            data: processedData,
            message: 'Data processed successfully'
        };

        // Return the response
        return new Response(JSON.stringify(result, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        // Log the error
        console.error('Error processing request:', error);
        
        // Return an error response
        const errorResponse = {
            status: 'error',
            message: error.message || 'An unknown error occurred',
            details: {
                name: error.name,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        };

        return new Response(JSON.stringify(errorResponse, null, 2), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}