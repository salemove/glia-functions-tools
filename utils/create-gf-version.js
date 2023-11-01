import request from './https/request.js';
import fs from 'fs/promises'

const createGfVersion = async (bearer, functionId, functionPath, envVars) => {
    console.log('env vars: ', envVars)
    const functionBuffer = await fs.readFile(functionPath);
    const functionCodeStr = '' + functionBuffer;
    const version = await request(`https://api.glia.com/functions/${functionId}/versions`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 10000, // in ms
    },
    {
        code: functionCodeStr, 
        environment_variables: JSON.parse(envVars),
        // compatibility_date: '2023-09-10'
    })
    console.log(version)
    return JSON.parse(version)
};

export default createGfVersion