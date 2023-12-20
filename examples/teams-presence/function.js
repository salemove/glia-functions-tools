export async function onInvoke(request, env) {
    try{
      const requestJson = await request.json();
      const payload = JSON.parse(requestJson.payload);
      console.log('request payload= ', payload)

      const mappingArray = [
        {
          
        }
      ]
      return new Response(JSON.stringify({
          input: payload,
          output: ''
      }));
    } catch(e) { 
      console.log(e); 
      return new Response(JSON.stringify({ error: e }))
    };
}