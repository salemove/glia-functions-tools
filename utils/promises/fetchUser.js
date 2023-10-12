import request from '../https/request.js';

const fetchUser = async (bearerToken, operatorId) => {
    const options = {
        method: "GET",
        headers: {
          "Accept": "application/vnd.salemove.v1+json",
          "Authorization": `Bearer ${bearerToken}`
        },
        timeout: 10000, // in ms
    };

    const url = `https://api.glia.com/operators/${operatorId}`;
    const operatorResponse = await request(url, options);
    return JSON.parse(operatorResponse);
}

export default fetchUser;