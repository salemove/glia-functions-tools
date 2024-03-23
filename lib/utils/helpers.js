const request =require("./https/request");

const buildOptions = method => headers => {
    return {
        method: method,
        headers: headers,
        timeout: 10000, // in ms
    };
}

const buildRequest = options => url => data => {
    return request(url, options, data)
}

const testRequest = pipe(
    buildOptions,
    buildRequest
)

testRequest("POST")({
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.salemove.v1+json'
  })(`https://api.glia.com/operator_authentication/tokens`)({
    api_key_id: process.env.GLIA_KEY_ID, 
    api_key_secret: process.env.GLIA_KEY_SECRET
}).then(x=>console.log(x))

const pipe = (...fns) =>
  (value) =>
    fns.reduce((acc, fn) => fn(acc), value);

module.exports=Object.freeze({
    pipe
})