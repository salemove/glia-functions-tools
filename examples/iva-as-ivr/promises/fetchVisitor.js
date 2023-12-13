import request from '../https/request.js';

const fetchVisitor = async (bearerToken, siteId, visitorId) => {
  try{
    const options = {
      method: "GET",
      headers: {
        "Accept": "application/vnd.salemove.v1+json",
        "Authorization": `Bearer ${bearerToken}`
      }
    };
    const url = `https://api.glia.com/sites/${siteId}/visitors/${visitorId}`;
    console.log('requesting visitor at: ', url);
    const visitorResponse = await request(url, options);
    const visitorJson = await visitorResponse.json()
    return visitorJson;
    } catch(error){
      console.log(error);
      return {message: error}
    }
}

export default fetchVisitor;