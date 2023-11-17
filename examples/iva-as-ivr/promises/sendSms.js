import request from '../https/request.js';

const sendSms = async (bearer, fromNumber, toNumber, message) => {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 1000, // in ms
    }
    const url = 'https://api.salemove.com/router/outbound_sms';
    const data = {
        from_number: fromNumber,
        to_number: toNumber,
        message: message
    }
    const smsResponse = await request(url, options, data);
    return JSON.parse(smsResponse);
};

export default sendSms;