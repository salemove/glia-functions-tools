/**
 * {{projectName}}
 * 
 * Basic Glia Function
 * @version {{version}}
 */

/**
 * Main function handler
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
        // Log the received request (avoid logging sensitive data in production)
        console.log('Processing request from {{projectName}}');
        console.log('Payload:', payload);
        
        // Your business logic here
        const result = {
            message: 'Hello from {{projectName}}!',
            timestamp: new Date().toISOString(),
            receivedData: payload
        };
        
        // Return the response
        return Response.JSON({
            success: true,
            data: result
        });
        
    } catch (error) {
        // Handle errors gracefully
        console.error('Error processing request:', error);
        
        return Response.JSON({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}