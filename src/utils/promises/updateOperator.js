import request from '../https/request.js';

const updateOperator = async (bearer, operatorId, data) => {
    const options = {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 10000, // in ms
    }
    const url = `https://api.glia.com/operators/${operatorId}`;
    const visitorResponse = await request(url, options, data);
    return JSON.parse(visitorResponse);
};

export default updateOperator;