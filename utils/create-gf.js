import request from './https/request.js';

const createGliaFunction = async (bearer, siteId, name, description) => {
    const newFunction = await request('https://api.glia.com/functions', {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 5000, // in ms
    },
    {
        site_id: siteId, 
        name: name,
        description: description
    })
    console.log(newFunction)
    return JSON.parse(newFunction)
};

export default createGliaFunction