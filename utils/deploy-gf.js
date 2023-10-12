import request from './https/request.js';

const deployGf = async (bearer, functionId, versionId) => {
    const deployment = await request(`https://api.glia.com/functions/${functionId}/deployments`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 5000, // in ms
    },
    {
        version_id: versionId
    })
    console.log(deployment)
    return JSON.parse(deployment)
};

export default deployGf