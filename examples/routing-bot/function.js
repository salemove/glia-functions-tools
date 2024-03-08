// "buildSuggestion" is not used in this example, but can be used to return a typical chat message
// See Glia developer documentation for additional types of responses and how to return multiple responses
import { buildSuggestion, transferToQueue, buildResponseBody } from './utils/gliaAi.js';

export async function onInvoke(request, env) {
    try{
      // request data
      const requestJson = await request.json();
      const payload = JSON.parse(requestJson.payload);
      const engagementId = payload.engagement_id;
      const visitorId = payload.visitor_id;
      const messageId = payload.message_id;
      const utterance = payload.utterance;

      // logging to assist with debugging
      console.log("REQUEST: ", `ENGAGEMENT ID: ${engagementId} | VISITOR ID: ${visitorId} | MESSAGE ID: ${messageId} | UTTERANCE: ${utterance}`)

      let responseBody

      // specify your Staging OR Production Queue ID here
      const queueId = '';

      // Conditional statements to handle different scenarios / user inputs
      switch (utterance) {
        case "account_support": 
          const transferAccount = transferToQueue('text', queueId, {});
          responseBody = buildResponseBody(transferAccount);
          return new Response(JSON.stringify(responseBody));
        case "lending_support":
          const suggestion = {
            "type": "suggestion",
            "content": "Do you need help with an existing product or can I help you find a new one?",
            "attachment": {
              "type": "single_choice",
              "options": [
                {
                  "text": "Current Loan / Credit Card",
                  "value": "existing_product"
                },
                {
                  "text": "New Loan / Credit Card",
                  "value": "new_product"
                }
              ]
            }
          }
          responseBody = buildResponseBody(suggestion)
          return new Response(JSON.stringify(responseBody));
        case "existing_product":
          const transferLending = transferToQueue("text", queueId, {})
          responseBody = buildResponseBody(transferLending)
          return new Response(JSON.stringify(responseBody));
      }

      // return Response
      console.log("RESPONSE BODY: ", responseBody)
      return new Response(JSON.stringify(responseBody));
    } catch(e) { 
      console.log(e); 
      return new Response(JSON.stringify({ error: e }))
    };
}