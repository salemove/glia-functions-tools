
const listFunctionsPromise = (siteId, headers) => {
    return fetch(
        `https://api.glia.com/functions?site_ids[]=${siteId}`,
        {
            method: GET,
            headers: headers
          }
    )
};

export default listFunctions