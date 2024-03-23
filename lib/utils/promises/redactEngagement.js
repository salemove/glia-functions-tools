import request from '../https/request.js';

const redactEngagement = async (bearer, data) => {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 1000, // in ms
    }
    console.log('data for redaction request is ', data)
    const url = `https://api.glia.com/engagements/data_redaction_requests`;
    const redactEngagementResponse = await request(url, options, data);
    return JSON.parse(redactEngagementResponse);
};

export default redactEngagement;