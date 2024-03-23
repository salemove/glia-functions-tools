import request from '../https/request.js';

const createQueueTicket = async (visitorToken, phoneNumber) => {
    const url = 'https://api.glia.com/queue_tickets';

    const options = {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${visitorToken}`
        },
        timeout: 10000, // in ms
    };

    const data = {
        media: "phone",
        media_options: {
            phone_number: phoneNumber
        },
        site_id: process.env.GLIA_TRANSFER_SITE_ID,
        source: "visitor_integrator",
        queue_ids: [process.env.GLIA_TRANSFER_QUEUE_ID]
    };
    await request(url, options, data);
};

export default createQueueTicket;