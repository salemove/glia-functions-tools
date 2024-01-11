import dotenv from 'dotenv';
dotenv.config();

const fetchVersion = async (functionId, versionId) => {
    const response = await fetch(`${process.env.GLIA_API_URL}/functions/${functionId}/versions/${versionId}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GLIA_BEARER_TOKEN}`
        },
    })
    const result = await response.json()
    return result
};

export default fetchVersion

