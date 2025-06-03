import request from './https/request.js';
import fs from 'fs/promises'
import dotenv from 'dotenv';
dotenv.config();

const createGfVersion = async (functionId, functionPath, compatibilityDate, environmentVariables) => {
    const functionBuffer = await fs.readFile(functionPath);
    const functionCodeStr = '' + functionBuffer;

    const payload = {
        code: functionCodeStr
    }

    if (compatibilityDate) {
        payload.compatibility_date = compatibilityDate
    }

    if (environmentVariables) {
        payload.environment_variables = environmentVariables
    }

    const version = await request(`${process.env.GLIA_API_URL}/functions/${functionId}/versions`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GLIA_BEARER_TOKEN}`
        },
        timeout: 10000, // in ms
    }, payload)
    
    return JSON.parse(version)
};

export default createGfVersion