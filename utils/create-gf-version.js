import request from './https/request.js';
import fs from 'fs/promises'
import dotenv from 'dotenv';
dotenv.config();

const createGfVersion = async (functionId, functionPath, compatibilityDate) => {
    const functionBuffer = await fs.readFile(functionPath);
    const functionCodeStr = '' + functionBuffer;
    const version = await request(`${process.env.GLIA_API_URL}/functions/${functionId}/versions`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GLIA_BEARER_TOKEN}`
        },
        timeout: 10000, // in ms
    },
    {
        code: functionCodeStr, 
        // environment_variables: envVars,
        compatibility_date: compatibilityDate
    })
    
    return JSON.parse(version)
};

export default createGfVersion