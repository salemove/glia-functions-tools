import request from './https/request.js';
import dotenv from 'dotenv';
dotenv.config();

const deployGf = async (functionId, versionId) => {
    const deployment = await request(`${process.env.GLIA_API_URL}/functions/${functionId}/deployments`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GLIA_BEARER_TOKEN}`
        },
        timeout: 5000, // in ms
    },
    {
        version_id: versionId
    })
    return JSON.parse(deployment)
};

export default deployGf