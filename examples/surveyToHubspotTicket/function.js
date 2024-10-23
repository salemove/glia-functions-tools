// function.js
async function apiCall(endpoint, method, body, token) {
    const url = `https://api.hubapi.com/${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };
    const options = {
      method,
      headers,
      body: method !== "GET" ? JSON.stringify(body) : void 0
    };
    const response = await fetch(url, options);
    if (!response.ok) {
      console.log("Response status: " + response.status);
      console.log("Response text: " + response.statusText);
    }
    return await response.json();
  }
  async function createTicket(engagementHistory, engagementId, hubspotContactId, token) {
    console.log("Creating ticket");
    const endpoint = "crm/v3/objects/tickets";
    const body = {
      properties: {
        hs_pipeline_stage: 1,
        subject: "Glia ticket from Survey " + engagementId,
        content: `
              Transcript: 
              ${engagementHistory}
              `
      }
    };
    if (hubspotContactId) {
      body.associations = [];
      body.associations.push(
        {
          "to": {
            "id": hubspotContactId
          },
          "types": [
            {
              "associationCategory": "HUBSPOT_DEFINED",
              "associationTypeId": 16
            }
          ]
        }
      );
    }
  
    console.log("Creating ticket: " + JSON.stringify(body));
  
    try {
      const data2 = await apiCall(endpoint, "POST", body, token);
      return data2;
    } catch (error) {
      console.log("Data Error: ", data);
      console.error("Error creating ticket:", error);
      return false;
    }
  }
  async function hubspotLookForEmail(token, email) {
    if (email !== "") {
      const endpoint = "crm/v3/objects/contacts/search";
      const body = {
          "filterGroups": [
              {
                "filters": [
                  {
                    "propertyName": "email",
                    "value": email,
                    "operator": "EQ"
                  }
                ]
              }
          ]
      };
  
      console.log("Looking for email: " + JSON.stringify(body, null, 2));
      try {
        const data2 = await apiCall(endpoint, "POST", body, token);
        if (data2.results && data2.results.length > 0) {
          return data2.results[0].id;
        } else {
          console.log("Nothing found: " + JSON.stringify(data2, null, 2));
          return false;
        }
      } catch (error) {
        console.error("Error retrieving data:", error);
        return false;
      }
    } else {
      return false;
    }
  }
  async function getAuthorizationToken(apiKeyId, apiKeySecret) {
    const url = "https://api.glia.com/operator_authentication/tokens";
    const headers = {
      "Accept": "application/vnd.salemove.v1+json",
      "Content-Type": "application/json"
    };
    const body = JSON.stringify({
      api_key_id: apiKeyId,
      api_key_secret: apiKeySecret
    });
    try {
      const response = await fetch(url, { method: "POST", headers, body });
      const data2 = await response.json();
      if (response.ok && data2.token) {
        return data2.token;
      } else {
        console.error("Failed to get authorization token:", data2);
      }
    } catch (error) {
      console.error("Error while fetching authorization token:", error);
    }
  }
  async function checkSurvey(token, engagementId, env) {
    const url = `https://api.glia.com/engagements/${engagementId}/survey_answers/operator`;
    const headers = {
      "Accept": "application/vnd.salemove.v1+json",
      "Authorization": `Bearer ${token}`
    };
    try {
      const response = await fetch(url, { method: "GET", headers });
      const data2 = await response.json();
      if (response.ok && data2.answers) {
        for (let i = 0; i < data2.answers.length; i++) {
          if (data2.answers[i].title === env.SURVEY_QUESTION) {
            if (data2.answers[i].answer === true) {
              return true;
            }
          }
        }
      } else {
        console.log("Error while checking survey:", data2);
        return false;
      }
    } catch (error) {
      console.error("Error while checking survey:", error);
    }
  }
  async function onInvoke(request, env) {
    const requestJson = await request.json();
    const parsed = JSON.parse(JSON.parse(requestJson.payload));
    const custom_fields = parsed["custom_fields"] || parsed.custom_fields;
    const engagement_id = parsed["engagement_id"] || parsed.engagement_id;
    const visitorEmail = parsed["visitorEmail"] || parsed.visitorEmail;
    const chat_transcript_plain_text = parsed["chat_transcript_plain_text"] || parsed.chat_transcript_plain_text;
    const hubspotToken = env.HUBSPOT_ACCESS_TOKEN;
    const token = await getAuthorizationToken(env.GLIA_USER_API_KEY, env.GLIA_USER_SECRET);
    let hubspotContactId = "";
    if (custom_fields && custom_fields.hubspotContactId) {
      hubspotContactId = custom_fields.hubspotContactId;
    } else {
      if (visitorEmail) {
        hubspotContactId = await hubspotLookForEmail(hubspotToken, visitorEmail);
      } else {
  
      }
    }
    const survey = await checkSurvey(token, engagement_id, env);
    if (survey) {
      const ticket = await createTicket(chat_transcript_plain_text, engagement_id, hubspotContactId, hubspotToken);
      console.log("Ticket: " + JSON.stringify(ticket));
    }
    return new Response(JSON.stringify({ status: 201 }));
  }
  export {
    onInvoke
  };
  