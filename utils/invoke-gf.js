import request from './https/request.js';
import dotenv from 'dotenv';
dotenv.config();

const invokeGliaFunction = async (invocationUri, payload) => {
    const result = await request(`${process.env.GLIA_API_URL}/${invocationUri}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GLIA_BEARER_TOKEN}`
        },
        timeout: 5000, // in ms
    }, payload)
    
    return JSON.parse(result)
};


export default invokeGliaFunction;
