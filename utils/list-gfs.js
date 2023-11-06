import request from './https/request.js';
import dotenv from 'dotenv';
dotenv.config();

const listGliaFunctions = async (siteId, name, description) => {
    const functionsList = await request(process.env.GLIA_API_URL + '/functions?site_ids[]=' + process.env.GLIA_SITE_ID, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GLIA_BEARER_TOKEN}`
        },
        timeout: 5000, // in ms
    })
    return JSON.parse(functionsList)
};

export default listGliaFunctions