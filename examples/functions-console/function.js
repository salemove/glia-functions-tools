const createBearerTokenPromise = (id, secret) => {
  return fetch(`https://api.glia.com/operator_authentication/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.salemove.v1+json'
      },
      body: JSON.stringify({
        api_key_id: id, 
        api_key_secret: secret
      })
  })
};

const makeHeaders => bearerToken => {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.salemove.v1+json',
    'Authorization': `Bearer ${bearerToken}`
  }
};

const postPromise = (url, method, headers, data) => {
  return fetch(
      url,
      {
          method: method,
          headers: headers,
          body: JSON.stringify(data)
      }
  )
};

export async function onInvoke(request, env) {
    try{
        const requestJson = await request.json();
        const payload = JSON.parse(requestJson.payload);
        // payload: { url, method, data }
        const bearer = await createBearerToken(env.GLIA_KEY_ID, env.GLIA_KEY_SECRET)
        const headers = makeHeaders(bearer);
        postPromise(payload.url, payload.method, headers, data)
          .then(res = res.json())
          .then(resultJson => return new Response(JSON.stringify(payload)))
    } catch(e) { 
        console.log(e); 
        return new Response(JSON.stringify({ error: e }))
    };
}