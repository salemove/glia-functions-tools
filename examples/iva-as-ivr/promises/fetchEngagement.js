import request from '../https/request.js';

const fetchEngagement = async (bearer, engagementId) => {
    const options = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 1000, // in ms
    }
    const url = `https://api.glia.com/engagements/${engagementId}`;
    const engagementResponse = await request(url, options);
    const engagementJson = await engagementResponse.json()
    return engagementJson;
};

export default fetchEngagement;