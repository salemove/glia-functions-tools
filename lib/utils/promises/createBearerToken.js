import request from '../https/request.js';

const createBearerToken = async (id, secret, api_url = 'https://api.glia.com') => {
    const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.salemove.v1+json'
        },
        timeout: 10000, // in ms
    }
    const url = `${api_url}/operator_authentication/tokens`;
    const data = {
        api_key_id: id, 
        api_key_secret: secret
    }
    const bearerTokenResponse = await request(url, options, data);
    return JSON.parse(bearerTokenResponse).token;
};

export default createBearerToken;