/**
 * AI Integration Template
 * 
 * This template demonstrates how to integrate with AI services like OpenAI
 * to enhance Glia Functions with generative AI capabilities.
 */

export async function onInvoke(request, env) {
    // Parse the request payload
    const requestJson = await request.json();
    const payload = JSON.parse(requestJson.payload);
    
    try {
        // Get API key from environment variables
        const apiKey = env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('Missing OPENAI_API_KEY environment variable');
        }
        
        // Extract the user's message
        const userMessage = payload.message;
        if (!userMessage) {
            throw new Error('Missing message in payload');
        }
        
        console.log('Processing AI request:', userMessage.substring(0, 50) + '...');
        
        // Prepare context for the AI
        const systemContext = payload.context || 'You are a helpful assistant within a Glia Functions integration.';
        
        // Call the OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: env.MODEL || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemContext },
                    { role: 'user', content: userMessage }
                ],
                temperature: parseFloat(env.TEMPERATURE || '0.7'),
                max_tokens: parseInt(env.MAX_TOKENS || '500', 10)
            })
        });
        
        // Handle API errors
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
        }
        
        // Process the AI response
        const result = await response.json();
        const aiMessage = result.choices[0].message.content;
        
        // Return the AI response
        return Response.JSON({
            success: true,
            response: aiMessage,
            usage: result.usage,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in AI integration:', error);
        
        return Response.JSON({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}