import request from './https/request.js';

const listFunctions = async (bearer, siteId) => {
    const result = await request(`https://api.glia.com/functions?site_ids[]=${siteId}`, {
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

export default listFunctions