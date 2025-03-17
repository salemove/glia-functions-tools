/**
 * API Integration Template
 * 
 * This template demonstrates how to securely integrate with external APIs
 * while handling authentication, errors, and response formatting.
 */

export async function onInvoke(request, env) {
    // Parse the request payload
    const requestJson = await request.json();
    const payload = JSON.parse(requestJson.payload);
    
    // Log the received request (avoid logging sensitive data in production)
    console.log('Processing API integration request');
    
    try {
        // Example of how to use environment variables for API credentials
        const apiKey = env.API_KEY || 'demo-key';
        const apiUrl = env.API_URL || 'https://api.example.com/v1';
        
        // Prepare the API request
        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        // Make the API request
        const response = await fetch(`${apiUrl}/endpoint`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                // Map your payload to the API requirements
                query: payload.searchTerm,
                limit: payload.limit || 10
            })
        });
        
        // Handle API response
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const apiResponse = await response.json();
        
        // Transform and return the API response
        return Response.JSON({
            success: true,
            data: apiResponse,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        // Handle errors gracefully
        console.error('Error in API integration:', error);
        
        return Response.JSON({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}