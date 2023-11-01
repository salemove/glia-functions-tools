import chatCompletion from './openai/chatCompletion.js'

export async function onInvoke(request, env) {
    try{
        const requestJson = await request.json();
        const envJson = await env.json();
        const payload = JSON.parse(requestJson.payload);
        const result = await chatCompletion(envJson.openAiSecret, payload.content);
        return new Response(JSON.stringify({
            input: payload,
            output: result.choices[0].message.content
        }));
    } catch(e) { 
        console.log(e); 
        return new Response(JSON.stringify({ error: e }))
    };
}