import request from '../https/request.js';

const fetchVisitor = async (bearerToken, visitorId) => {
    const options = {
        method: "GET",
        headers: {
          "Accept": "application/vnd.salemove.v1+json",
          "Authorization": `Bearer ${bearerToken}`
        },
        timeout: 1000, // in ms
    };

    const url = `https://api.glia.com/sites/${process.env.GLIA_TRANSFER_SITE_ID}/visitors/${visitorId}`;
    const visitorResponse = await request(url, options);
    return JSON.parse(visitorResponse);
}

export default fetchVisitor;