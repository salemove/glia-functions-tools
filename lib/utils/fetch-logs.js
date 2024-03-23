const fetchGfLogsFunction = async (bearer, requestUrl, existingLogs) => {
    console.log(requestUrl)
    const logs = existingLogs || [];
    const result = await fetch(requestUrl, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearer}`
        }
    })
    const parsed = await result.json();
    parsed.logs.forEach(log => logs.push(log))
    if (parsed.next_page != null) {
        await fetchGfLogsFunction(bearer, parsed.next_page, logs)
    }
    return logs.sort(function(x, y){
        return x.timestamp - y.timestamp;
    })
};

const fetchGfLogs = async (functionId) => {
    const initialRequestUrl = `${process.env.GLIA_API_URL}/functions/${functionId}/logs`;
    const logs = await fetchGfLogsFunction(process.env.GLIA_BEARER_TOKEN, initialRequestUrl)
    return logs
};

export default fetchGfLogs