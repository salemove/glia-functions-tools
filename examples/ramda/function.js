import * as R from 'ramda';

export async function onInvoke(request, env) {
    const requestJson = await request.json();
    const payload = JSON.parse(requestJson.payload);
    const multiply = (x, y) => x * y;
    const curriedMultiply = R.curry(multiply);
    try{
        Object.entries(payload).forEach(([k,v]) => console.log('Key: '+k+', value: '+v));
        console.log(curriedMultiply(2)(3)(4))
    } catch(e) { 
        console.log(e); 
    };
    return new Response(requestJson.payload);
}