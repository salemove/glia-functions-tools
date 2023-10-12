import createBearerToken from './promises/createBearerToken.js'
import request from './https/request.js';

const fetchGf = async (id, secret, functionId) => {
    const bearer = await createBearerToken(id, secret);
    const result = await request(`https://api.glia.com/functions/${functionId}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 5000, // in ms
    })
    console.log(result)
    return JSON.parse(result)
};

export default fetchGf