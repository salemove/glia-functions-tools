import request from '../https/request.js';

const updatePhoneChannel = async (bearer, phoneNumber, data) => {
    const options = {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 10000, // in ms
    }
    const url = `https://api.glia.com/omnicall/incoming_phone_numbers/${phoneNumber}`;
    const phoneResponse = await request(url, options, data);
    return JSON.parse(phoneResponse);
};

export default updatePhoneChannel;