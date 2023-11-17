import request from '../https/request.js';

const fetchQueueWaitTime = async (bearer, siteId, queueId) => {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 1000, // in ms
    };
    const data = {
        site_ids: [siteId],
        queue_ids: [queueId]
    }
    const url = `https://api.glia.com/reporting/live/queue/average_wait_time`;
    const queueWaitTimeResponse = await request(url, options, data);
    return JSON.parse(queueWaitTimeResponse);
};

export default fetchQueueWaitTime;

