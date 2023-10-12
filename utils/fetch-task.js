const fetchTask = async (bearer, gfTaskPath) => {
    const taskEndpoint = `https://api.glia.com${gfTaskPath}`;
    console.log(taskEndpoint)
    const response = await fetch(taskEndpoint, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearer}`
        },
    })
    const result = await response.json()
    console.log(result)
    return result
};

export default fetchTask