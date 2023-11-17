import request from '../https/request.js';

const createVisitor = async (bearerToken) => {
    const url = 'https://api.glia.com/visitors';
    const options = {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`
        },
        timeout: 1000, // in ms
    };

    const visitorResponse = await request(url, options);
    return JSON.parse(visitorResponse);
};

export default createVisitor;

