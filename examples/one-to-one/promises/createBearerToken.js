import request from '../https/request.js';

const createBearerToken = async (id, secret) => {
    const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.salemove.v1+json'
        }
    }
    const url = `https://api.glia.com/operator_authentication/tokens`;
    const data = {
        api_key_id: id, 
        api_key_secret: secret
    }
    const bearerTokenResponse = await request(url, options, data);
    const bearerTokenJson = await bearerTokenResponse.json()
    console.log(JSON.stringify(bearerTokenJson));
    return bearerTokenJson.token;
};

export default createBearerToken;