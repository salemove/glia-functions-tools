import request from '../https/request.js';

const sendSms = async (bearer, fromNumber, toNumber, message) => {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json',
            'Authorization': `Bearer ${bearer}`
        }
    }
    const url = 'https://api.glia.com/router/outbound_sms';
    const data = {
        from_number: fromNumber,
        to_number: toNumber,
        message: message
    }
    const smsResponse = await request(url, options, data);
    const smsResponseJson = await smsResponse.json();
    return smsResponseJson;
};

export default sendSms;