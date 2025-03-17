import createBearerToken from './promises/createBearerToken.js'
import request from './https/request.js';

const fetchGfCode = async (bearer, functionId, versionId) => {
    const url = `https://api.glia.com/functions/${functionId}/versions/${versionId}/code`;
    console.log('fetching code from: ', url)
    const result = await request(url, {
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

export default fetchGfCode