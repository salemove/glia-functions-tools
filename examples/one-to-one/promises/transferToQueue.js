import request from '../https/request.js';

// can also add webhooks
const transferToQueue = async (bearer, engagementId, queueId, media, message) => {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json',
            'Authorization': `Bearer ${bearer}`
        }
    }
    const url = `https://api.glia.com/transfer_tickets`;
    const transferResponse = await request(url, options, {
        engagement_id: engagementId,
        queue_id: queueId,
        media: media,
        message: message
    });
    const transferResponseJson = await transferResponse.json();
    return transferResponseJson;
};

export default transferToQueue;