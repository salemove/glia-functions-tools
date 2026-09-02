
// can also add webhooks
const getOperators = async (bearer, operatorName, siteId) => {
    const options = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json',
            'Authorization': 'Bearer '+ bearer
        }
    }
    const url = 'https://api.glia.com/operators?contains='+encodeURI(operatorName)+'&include_engagements=false&include_disabled=false&include_support=false&include_offline=true&include_external=false&site_ids[]='+siteId+'&search_by=name';
   
    console.log("Operators URL: "+url);
    
    try {
        
        const operatorsResponse = await fetch(url, options);
        console.log("operatorsResponse = "+JSON.stringify(operatorsResponse));

        if(operatorsResponse.ok) {
            try {
                const operatorsResponseJson = await operatorsResponse.json();    
                
                return operatorsResponseJson;
            } catch (error) {
                throw new Error(error);
            }
        } else {
            const responseText = operatorsResponse.status+", " + operatorsResponse.statusText;
            console.log('Glia Request Status = '+responseText);
            const errorText = responseText;         
            throw new Error(errorText);   
        }
        
            
    } catch (error) {
       console.log(">>>>error:"+error );
       throw new Error(error);
    }
    
    
};

export default getOperators;