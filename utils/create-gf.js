import request from './https/request.js';
import dotenv from 'dotenv';
dotenv.config();

const createGliaFunction = async (siteId, name, description) => {
    const newFunction = await request(process.env.GLIA_API_URL + '/functions', {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GLIA_BEARER_TOKEN}`
        },
        timeout: 5000, // in ms
    },
    {
        site_id: siteId, 
        name: name,
        description: description
    })
    return JSON.parse(newFunction)
};

export default createGliaFunction