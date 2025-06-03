/**
 * State Machine Template
 * 
 * This template demonstrates a simple state machine pattern for
 * managing conversation flow or multi-step processes.
 */

// Define states
const STATES = {
    INIT: 'INIT',
    COLLECTING_INFO: 'COLLECTING_INFO',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
};

// State transition handlers
const stateHandlers = {
    [STATES.INIT]: handleInit,
    [STATES.COLLECTING_INFO]: handleCollectingInfo,
    [STATES.PROCESSING]: handleProcessing,
    [STATES.COMPLETED]: handleCompleted,
    [STATES.ERROR]: handleError
};

export async function onInvoke(request, env) {
    // Parse the request payload
    const requestJson = await request.json();
    const payload = JSON.parse(requestJson.payload);
    
    try {
        // Extract or initialize state
        const currentState = payload.state || STATES.INIT;
        console.log(`Processing state: ${currentState}`);
        
        // Handle the current state
        const handler = stateHandlers[currentState];
        if (!handler) {
            throw new Error(`Unknown state: ${currentState}`);
        }
        
        // Execute the state handler
        const result = await handler(payload, env);
        
        // Return the result with updated state
        return Response.JSON(result);
        
    } catch (error) {
        console.error('Error in state machine:', error);
        
        // Return error state
        return Response.JSON({
            state: STATES.ERROR,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// State handler implementations
async function handleInit(payload, env) {
    // Initialize the process
    return {
        state: STATES.COLLECTING_INFO,
        message: 'Process initialized, ready to collect information',
        requiredFields: ['name', 'email', 'purpose'],
        timestamp: new Date().toISOString()
    };
}

async function handleCollectingInfo(payload, env) {
    // Validate required information
    const requiredFields = ['name', 'email', 'purpose'];
    const missingFields = requiredFields.filter(field => !payload[field]);
    
    if (missingFields.length > 0) {
        return {
            state: STATES.COLLECTING_INFO,
            message: `Missing required fields: ${missingFields.join(', ')}`,
            requiredFields: missingFields,
            timestamp: new Date().toISOString()
        };
    }
    
    // All required information collected, move to processing
    return {
        state: STATES.PROCESSING,
        message: 'All required information collected, processing request',
        collectedData: {
            name: payload.name,
            email: payload.email,
            purpose: payload.purpose
        },
        timestamp: new Date().toISOString()
    };
}

async function handleProcessing(payload, env) {
    // Process the collected information
    // This could include API calls, data transformations, etc.
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Processing completed, move to completed state
    return {
        state: STATES.COMPLETED,
        message: 'Request processed successfully',
        result: {
            confirmationId: `REQ-${Date.now()}`,
            processingTime: '0.5s'
        },
        timestamp: new Date().toISOString()
    };
}

async function handleCompleted(payload, env) {
    // Handle any post-completion actions
    return {
        state: STATES.COMPLETED,
        message: 'Process already completed',
        result: payload.result,
        timestamp: new Date().toISOString()
    };
}

async function handleError(payload, env) {
    // Handle error recovery or provide guidance
    return {
        state: STATES.INIT,
        message: 'Restarting process after error',
        previousError: payload.error,
        timestamp: new Date().toISOString()
    };
}