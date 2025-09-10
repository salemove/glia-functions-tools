/**
 * Example Glia Function
 * This function demonstrates basic functionality including:
 * - Request handling
 * - Environment variables
 * - KV Store usage
 * - Response formatting
 */

export async function onInvoke(request, env, kvStoreFactory) {
    try {
        // Parse the incoming request
        const body = await request.json();
        console.log('Received request:', JSON.stringify(body));
        
        // Access environment variables
        const debugMode = env.DEBUG === 'true';
        const apiTimeout = parseInt(env.API_TIMEOUT || '30000');
        
        if (debugMode) {
            console.log('Debug mode enabled');
            console.log('API timeout:', apiTimeout);
        }
        
        // Initialize KV Store
        const kvStore = kvStoreFactory.initializeKvStore();
        
        // Example: Store request timestamp
        await kvStore.set({
            key: 'last_request_time',
            value: new Date().toISOString()
        });
        
        // Example: Get stored counter and increment
        let counter = await kvStore.get('request_counter');
        const newCount = (counter?.value || 0) + 1;
        await kvStore.set({
            key: 'request_counter', 
            value: newCount
        });
        
        // Process the request
        const response = {
            message: 'Hello from Glia Functions!',
            timestamp: new Date().toISOString(),
            requestCount: newCount,
            input: body,
            environment: {
                debug: debugMode,
                timeout: apiTimeout
            }
        };
        
        console.log('Sending response:', JSON.stringify(response));
        
        return new Response(JSON.stringify(response), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
    } catch (error) {
        console.error('Function error:', error.message);
        
        return new Response(JSON.stringify({
            error: 'Internal function error',
            message: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}