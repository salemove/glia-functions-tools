import request from '../https/request.js';

const createSiteBearerToken = async (id, secret) => {
    const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.salemove.v1+json'
        }
    }
    const url = `https://api.glia.com/sites/tokens`;
    const data = {
        api_key_id: id, 
        api_key_secret: secret
    }
    const bearerTokenResponse = await request(url, options, data);
    const bearerTokenResponseJson = await bearerTokenResponse.json()
    return bearerTokenResponseJson.access_token;
};

export default createSiteBearerToken;