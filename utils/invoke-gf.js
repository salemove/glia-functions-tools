import createBearerToken from './promises/createBearerToken.js'
import request from './https/request.js';

const invokeGliaFunction = async (id, secret, invocationUri) => {
    const bearer = await createBearerToken(id, secret);
    const result = await request(`https://api.glia.com${invocationUri}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 5000, // in ms
    },
    {
        foo: "bar"
    }
    )
    console.log(result)
    return JSON.parse(result)
};

invokeGliaFunction(
    process.env.GLIA_KEY_ID,
    process.env.GLIA_KEY_SECRET,
    '' // latest version
)