import chatCompletion from './openai/chatCompletion.js'

export async function onInvoke(request, env) {
    try{
        const requestJson = await request.json();
        const payload = JSON.parse(requestJson.payload);
        const result = await chatCompletion(payload.content);
        return new Response(JSON.stringify({
            input: payload,
            output: result
        }));
    } catch(e) { 
        console.log(e); 
    };
}