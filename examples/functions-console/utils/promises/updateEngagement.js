import request from '../https/request.js';

const updateEngagement = async (bearer, engagementId, data) => {
    const options = {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json',
            'Authorization': `Bearer ${bearer}`
        }
    }
    const url = `https://api.glia.com/engagements/${engagementId}`;
    const engagementResponse = await request(url, options, data);
    const engagementResponseJson = await engagementResponse.json();
    return engagementResponseJson;
};

export default updateEngagement;