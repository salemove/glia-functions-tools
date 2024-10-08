/*
This function demonstrates how to create a bot that can route to a specific agent in Glia. 

Bot flow:
1. Greeting and ask who the visitor would like to speak to. This is done with a queue welcome message.
2. Look up operator by name
    - If the operator doesn't exist respond in kind to the visitor
3. If the operator exists, check if they are avaialble. 
    - If the operator is available transfer to them
    - If operator is not available tell the visitor and offer to send them to the general queue
    


Input:
'{
      "engagement_id": "$engagement_id",
      "visitor_id": "$visitor_id",
      "site_id": "$site_id",
      "account_id": "$account_id",
      "message_id": "$message_id",
      "message_created_at": "2019-07-25T05:46:15+0000",
      "utterance": "Scott",
      "visitor_attributes": {
        "policy_number": "P123456789",
        "customer_number": "C00000123",
        "id_token": "eyJhbGciOiJub25lIn0.eyJuYW1lIjoiSm9obiBEb2UiLCJnaXZlbl9uYW1lIjoiSm9obiIsImZhbWlseV9uYW1lIjoiRG9lIiwiZW1haWwiOiJqb2huLmRvZUBleGFtcGxlLmNvbSIsInN1YiI6ImpvaG4uZG9lIiwiZXhwIjoxNjcxNDYzNDk4LCJpYXQiOjE2NzEwMzE0OTh9.",
        "access_token": null
      },
      "message_metadata": {
        "speech_to_text_type": "audio"
      },
      "engine_settings": {
        "customKey": "Custom Value"
      }
    }'

    

*/
import createBearerToken from './promises/createBearerToken.js';
import getOperators from './promises/getOperators.js';

const apiKey = ""
const apiSecret = ""
const siteId = ""

export async function onInvoke(request) {
    const requestJson = await request.json(); 
    
                
    try {
        var payload = JSON.parse(requestJson.payload);        
    } catch(error) {
        console.log("error parsing");
        return new Response(JSON.stringify({'exception':error}));
    }

    //Get the input
    var operatorName = payload.utterance; //in prod due validation
    
    //Get bearer token
    var bearerToken = await createBearerToken(apiKey, apiSecret);
    console.log(">>>invoking get operators");
    
    //Get the operators
    var operators = await getOperators(bearerToken, operatorName, siteId);
    console.log('Operators: '+JSON.stringify(operators));

   
    //Start transfer
 
   var transfer = {'messages':[{'type':'suggestion','content':'The agent you requested can not be found. Please type the name again.'}],'confidence_level':.099};

   if(operators.operators.length > 0 ) {
    transfer = {'messages':[{'type':'transfer','properties':{'version':'0','media':'text','operator_id':operators.operators[0].id,'notifications': {'success': 'I am transferring you to '+operatorName, 'failure': 'I can\'t transfer you to '+operatorName+' at this time','transfer_already_ongoing': 'I am already transferring you to '+operatorName,'declined':'I am sorry, '+operatorName+' is busy','timed_out': 'I am sorry, '+operatorName+' seems to be away'}}}],'confidence_level':0.99};
   }
     
   
   console.log("Transfer request>>> "+JSON.stringify(transfer)); 
   
    
    return new Response(JSON.stringify(transfer));
}

