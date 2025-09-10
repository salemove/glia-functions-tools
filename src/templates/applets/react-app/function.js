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
        // Allow CORS preflight requests
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Max-Age': '86400'
                }
            });
        }

        // Log the incoming request
        console.log('Received request:', request);

        // Parse the request body
        const requestWrapper = await request.json();
        
        // The actual payload is in the 'payload' field as a string
        const payload = JSON.parse(requestWrapper.payload || '{}');
        
        console.log('Parsed payload:', payload);

        // Extract data from the payload
        const { action, data } = payload;

        // Handle different actions
        switch (action) {
            case 'process':
                return handleProcessAction(data, env);
            
            case 'fetch-data':
                return handleFetchDataAction(data, env);
            
            case 'analyze':
                return handleAnalyzeAction(data, env);
            
            default:
                throw new Error(`Unknown action: ${action}`);
        }

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

/**
 * Handle the 'process' action
 * 
 * @param {Object} data - The data to process
 * @param {Object} env - Environment variables
 * @returns {Response} - Response object
 */
async function handleProcessAction(data, env) {
    // Validate input
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid data for process action');
    }

    const { text, number, options } = data;

    // Validate required fields
    if (text === undefined) {
        throw new Error('Text input is required');
    }
    
    if (number === undefined || isNaN(number)) {
        throw new Error('Valid number input is required');
    }

    // Process the data
    const processedData = {
        originalText: text,
        processedText: text.toUpperCase(),
        originalNumber: number,
        processedNumber: number * 2,
        options,
        timestamp: new Date().toISOString(),
        // Include any environment variables that are safe to expose
        apiUrl: env.API_URL // This comes from the environment variables
    };

    // Return the processed data
    return createSuccessResponse({
        data: processedData,
        message: 'Data processed successfully'
    });
}

/**
 * Handle the 'fetch-data' action
 * 
 * @param {Object} data - The request data
 * @param {Object} env - Environment variables
 * @returns {Response} - Response object
 */
async function handleFetchDataAction(data, env) {
    // This is a simulated external API call
    // In a real implementation, you would make an actual API request

    // Generate sample data
    const items = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i + 1}`,
        name: `Sample Item ${i + 1}`,
        value: Math.floor(Math.random() * 100),
        created: new Date(Date.now() - Math.floor(Math.random() * 10000000)).toISOString()
    }));

    // Return the fetched data
    return createSuccessResponse({
        items,
        count: items.length,
        timestamp: new Date().toISOString(),
        message: 'Data fetched successfully'
    });
}

/**
 * Handle the 'analyze' action
 * 
 * @param {Object} data - The data to analyze
 * @param {Object} env - Environment variables
 * @returns {Response} - Response object
 */
async function handleAnalyzeAction(data, env) {
    // Validate input
    if (!data || typeof data !== 'object' || !data.content) {
        throw new Error('Valid content is required for analysis');
    }

    const { content } = data;

    // Analyze the content (this is a simple example)
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const characterCount = content.length;
    const sentences = content.split(/[.!?]+/).filter(Boolean).length;
    
    // Calculate sentiment (very simple approach)
    const positiveWords = ['good', 'great', 'excellent', 'best', 'happy', 'positive'];
    const negativeWords = ['bad', 'worst', 'terrible', 'poor', 'negative', 'unhappy'];
    
    const words = content.toLowerCase().split(/\W+/).filter(Boolean);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    const sentimentScore = (positiveCount - negativeCount) / words.length;
    let sentiment = 'neutral';
    if (sentimentScore > 0.05) sentiment = 'positive';
    if (sentimentScore < -0.05) sentiment = 'negative';

    // Return the analysis
    return createSuccessResponse({
        analysis: {
            wordCount,
            characterCount,
            sentences,
            sentiment,
            sentimentScore
        },
        message: 'Content analyzed successfully'
    });
}

/**
 * Create a success response
 * 
 * @param {Object} data - The response data
 * @returns {Response} - Response object
 */
function createSuccessResponse(data) {
    const response = {
        status: 'success',
        ...data
    };

    return new Response(JSON.stringify(response, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}