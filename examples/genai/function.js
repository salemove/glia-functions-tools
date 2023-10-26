import OpenAI from 'openai';

export async function onInvoke(request, env) {
    try{
        const requestJson = await request.json();
        const payload = JSON.parse(requestJson.payload);
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_SECRET
        });
        const chatCompletion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: 'Say this is a test' }],
            model: 'gpt-3.5-turbo',
          });
          console.log(chatCompletion.choices);
        return new Response(JSON.stringify({
            input: payload,
            output: chatCompletion.choices
        }));
    } catch(e) { 
        console.log(e); 
    };
}