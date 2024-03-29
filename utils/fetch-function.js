import request from './https/request.js';
import dotenv from 'dotenv';
dotenv.config();

const fetchGf = async (functionId) => {
    const result = await request(`${process.env.GLIA_API_URL}/functions/${functionId}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GLIA_BEARER_TOKEN}`
        },
        timeout: 5000, // in ms
    })
    return JSON.parse(result)
};

export default fetchGf