import request from '../https/request.js';

const updateVisitor = async (bearer, visitorId, siteId, data) => {
    const options = {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 1000, // in ms
    }
    const url = `https://api.glia.com/sites/${siteId}/visitors/${visitorId}`;
    const visitorResponse = await request(url, options, data);
    const visitorJson = await visitorResponse.json();
    return visitorJson;
};

export default updateVisitor;