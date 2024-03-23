import request from '../https/request.js';

const createTeam = async (bearerToken, teamName, siteId) => {
    const url = 'https://api.glia.com/teams';

    const options = {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`
        },
        timeout: 10000, // in ms
    };

    const data = {
        name: teamName,
        site_id: siteId,
        description: "test"
    };
    const response = await request(url, options, data);
    return JSON.parse(response)
};

export default createTeam;