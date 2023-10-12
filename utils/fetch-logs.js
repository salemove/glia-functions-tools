import createBearerToken from './promises/createBearerToken.js'
import request from './https/request.js';

const fetchGfLogs = async (id, secret, functionId) => {
    const bearer = await createBearerToken(id, secret);
    const result = await request(`https://api.glia.com/functions/${functionId}/logs`, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 9000, // in ms
    })
    console.log(result)
    return JSON.parse(result)
};

export default fetchGfLogs