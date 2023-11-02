import request from './https/request.js';

const fetchGfLogs = async (bearer, requestUrl, existingLogs) => {
    const logs = existingLogs || [];
    const result = await request(requestUrl, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearer}`
        },
        timeout: 90000, // in ms
    })
    const parsed = JSON.parse(result)
    parsed.logs.forEach(log => logs.push(log))
    if (parsed.next_page != null) {
        console.log(parsed.next_page)
        await fetchGfLogs(bearer, parsed.next_page, logs)
    }
    return logs.sort(function(x, y){
        return x.timestamp - y.timestamp;
    })
};

export default fetchGfLogs