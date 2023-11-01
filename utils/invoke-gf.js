import createBearerToken from './promises/createBearerToken.js'
import request from './https/request.js';

const invokeGliaFunction = async (bearer, invocationUri) => {
    const result = await request(`https://api.glia.com${invocationUri}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 50000, // in ms
    },
    {
        foo: "bar"
    }
    )
    console.log(result)
    return JSON.parse(result)
};

export default invokeGliaFunction;

// invokeGliaFunction(
//     process.env.GLIA_KEY_ID,
//     process.env.GLIA_KEY_SECRET,
//     '' // latest version
// )