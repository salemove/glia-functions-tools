/**
 * Echo Payload Function
 * This function receives a payload and echoes it back
 * Follows Glia Functions structure with onInvoke handler
 */

export async function onInvoke(request, env, kvStoreFactory) {
    try {
        // Parse the incoming request
        const body = await request.json();
        console.log('Received payload:', JSON.stringify(body));

        // Initialize KV Store for tracking requests
        const kvStore = kvStoreFactory.initializeKvStore();

        // Get and increment echo counter
        let counter = await kvStore.get('echo_counter');
        if (counter == null) {
            counter = { key: 'echo_counter', value: 0 };
            console.log("First time calling the function");
        }
        await kvStore.set({
            key: 'echo_counter',
            value: counter.value + 1
        });
        
        // Echo the payload back with additional metadata
        const response = {
            message: 'Payload echoed successfully',
            echoCount: JSON.stringify(counter),
            timestamp: new Date().toISOString(),
            receivedPayload: body.payload.message
        };
        console.log('Response prepared');
        return new Response(JSON.stringify(response));

    } catch (error) {
        console.error('Echo function error:', error.message);

        return new Response(JSON.stringify({
            error: 'Echo function error',
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