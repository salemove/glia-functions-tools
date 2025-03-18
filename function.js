export async function onInvoke(request, env) {
    const requestJson = await request.json();
    const payload = JSON.parse(requestJson.payload);
    try{
        Object.entries(payload).forEach(([k,v]) => console.log('Key: '+k+', value: '+v));
    } catch(e) { 
        console.log('input is not a json'); 
    };
    return new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' }
    });
}
