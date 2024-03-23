import request from '../https/request.js';

const fetchQueue = async (bearerToken, queueId) => {
    const options = {
        method: "GET",
        headers: {
          "Accept": "application/vnd.salemove.v1+json",
          "Authorization": `Bearer ${bearerToken}`
        },
        timeout: 10000, // in ms
    };

    const url = `https://api.glia.com/queues/${queueId}`;
    const queueResponse = await request(url, options);
    return JSON.parse(queueResponse);
}

export default fetchQueue;