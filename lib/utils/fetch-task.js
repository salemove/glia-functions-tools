import dotenv from 'dotenv';
dotenv.config();

const fetchTask = async (taskPath) => {
    const taskEndpoint = `${process.env.GLIA_API_URL}/${taskPath}`;
    const response = await fetch(taskEndpoint, {
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

export default fetchTask