export async function onInvoke(request, env) {
    return new Response(JSON.stringify({ hello: 'world' }));
}