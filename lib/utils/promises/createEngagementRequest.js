import request from '../https/request.js';

const createEngagementRequest = async (mediaType, operatorId, siteId, bearerToken) => {
    const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.salemove.v1+json',
          'Authorization': `Bearer ${bearerToken}`
        },
        timeout: 1000, // in ms
    }
    const url = `https://api.glia.com/engagement_requests`;
    const data = {
        media: mediaType,
        // media_options: {one_way: true},
        operator_id: operatorId,
        site_id: siteId,
        source: 'visitor_integrator'
      }
    const engagementRequestResponse = await request(url, options, data);
    return JSON.parse(engagementRequestResponse);
};

export default createEngagementRequest;