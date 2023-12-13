import request from '../https/request.js';

const createQueueTicket = async (visitorToken, phoneNumber, siteId, queueId) => {
    const url = 'https://api.glia.com/queue_tickets';

    const options = {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${visitorToken}`
        }
    };

    const data = {
        media: "phone",
        media_options: {
            phone_number: phoneNumber
        },
        site_id: siteId,
        source: "visitor_integrator",
        queue_ids: [queueId]
    };
    const result = await request(url, options, data);
    const resultJson = await result.json();
    return resultJson
};

export default createQueueTicket;