import request from '../https/request.js';

const createQueue = async (bearerToken, queueName, siteId, teamId) => {
    const url = 'https://api.glia.com/queues';

    const options = {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`
        },
        timeout: 10000, // in ms
    };

    const data = {
        name: queueName,
        site_id: siteId,
        capacity_policy: {
            "type": "fixed",
            "capacity": 5
        },
        routing_policy: {
            media: [
            "phone",
            "text",
            "audio",
            "video"
            ],
            team_ids: [teamId]
        },
    };
    const response = await request(url, options, data);
    return JSON.parse(response)
};

export default createQueue;