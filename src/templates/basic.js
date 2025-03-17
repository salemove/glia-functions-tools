/**
 * Basic Glia Function Template
 * 
 * This template provides a minimal starting point for a Glia Function
 * with proper request handling and response formatting.
 */

export async function onInvoke(request, env) {
    // Parse the request payload
    const requestJson = await request.json();
    const payload = JSON.parse(requestJson.payload);
    
    // Process the payload
    console.log('Processing request payload:', payload);
    
    // Your business logic here
    const result = {
        message: 'Hello from Glia Functions!',
        receivedData: payload
    };
    
    // Return the response
    return Response.JSON(result);
}