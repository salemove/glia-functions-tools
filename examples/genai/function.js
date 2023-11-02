// import chatCompletion from './openai/chatCompletion.js'

export async function onInvoke(request, env) {
    try{
        const requestJson = await request.json();
        const payload = JSON.parse(requestJson.payload);
        // const result = await chatCompletion(env.OPENAI_SECRET, payload.content);
        const result = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.OPENAI_SECRET}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                  {
                    role: "system",
                    content: "You are a helpful assistant."
                  },
                  {
                    role: "user",
                    content: payload.content
                  }
                ]
              })
        }).then(res => res.json())
        console.log(result)
        return new Response(JSON.stringify({
            input: payload,
            // output: JSON.parse(result).choices[0].message.content
            output: result.choices[0].message.content
        }));
    } catch(e) { 
        console.log(e); 
        return new Response(JSON.stringify({ error: e }))
    };
}