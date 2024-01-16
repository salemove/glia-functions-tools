import request from '../https/request.js';

const createVisitor = async (bearerToken) => {
    const url = 'https://api.glia.com/visitors';
    const options = {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`
        }
    };

    const visitorResponse = await request(url, options);
    const visitorResponseJson = await visitorResponse.json();
    return visitorResponseJson;
};

export default createVisitor;

