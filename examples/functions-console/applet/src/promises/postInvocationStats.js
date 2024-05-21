const postInvocationStatsPromise = (headers, functionIdsArray) => {
    return fetch(
        `https://api.glia.com/functions/stats`,
        {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                function_ids: functionIdsArray
            })
        }
    )
};

export default postInvocationStatsPromise