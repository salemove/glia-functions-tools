async function apiCall(endpoint, method, body, token) {
    const url = `https://api.hubapi.com/${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const options = {
        method: method,
        headers: headers,
        body: method !== "GET" ? JSON.stringify(body) : undefined 
    };

    const response = await fetch(url, options);

    // Handle network errors
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
            subject: "Glia ticket from Survey "+engagementId,
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
            });
    }

    try {
        const data = await apiCall(endpoint, "POST", body, token);
        return data;
        
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
            filterGroups: [
                {
                    filters: [
                        {
                            propertyName: "email",
                            value: email,
                            operator: "EQ"
                        }
                    ]
                }
            ]
        };

        try {
            const data = await apiCall(endpoint, "POST", body, token);
            
            if (data.results && data.results.length > 0) {
                return data.results[0].id; // Make sure there's at least one result
            } else {
                console.log("Nothing found?");
                return false; // Explicitly return false if no results
            }
        } catch (error) {
            console.error("Error retrieving data:", error);
            return false; // Handle error: return false if API call fails
        }
    } else {
        return false; // Return false for empty emails
    }
}



async function getAuthorizationToken(apiKeyId, apiKeySecret) {
    const url = 'https://api.glia.com/operator_authentication/tokens';
    const headers = {
        'Accept': 'application/vnd.salemove.v1+json',
        'Content-Type': 'application/json',
    };
    const body = JSON.stringify({
        api_key_id: apiKeyId,
        api_key_secret: apiKeySecret,
    });
    
    try {
        const response = await fetch(url, { method: 'POST', headers: headers, body: body });
        const data = await response.json();
        
        // Assuming the token is returned in a property named 'token' in the response
        if (response.ok && data.token) {
            return data.token;
        } else {
            console.error('Failed to get authorization token:', data);
        }
    } catch (error) {
        console.error('Error while fetching authorization token:', error);
    }
  }
  

async function checkSurvey(token, engagementId, env)
{
    const url = `https://api.glia.com/engagements/${engagementId}/survey_answers/operator`

    const headers = {
        "Accept": "application/vnd.salemove.v1+json",
        "Authorization": `Bearer ${token}`
    };
    try {
        const response = await fetch(url, { method: 'GET', headers: headers })
        const data = await response.json();

        // loop through answers until we find the question "Open a Hubspot Ticket?"

        if(response.ok && data.answers) {
            for(let i = 0; i < data.answers.length; i++) {
                if(data.answers[i].title === env.SURVEY_QUESTION) {
                    if(data.answers[i].answer === true) {
                        return true;
                    }
                }
            }
        } else {
            console.log("Error while checking survey:", data);
            return false;
        }         
    } catch (error) {
        console.error("Error while checking survey:", error);
    }
}

async function onInvoke(request, env) {
    const requestJson = await request.json();
    const parsed = JSON.parse(JSON.parse(requestJson.payload));
    // parsed contains information passed through the webhook
    const custom_fields = parsed["custom_fields"] || parsed.custom_fields;
    const engagement_id = parsed["engagement_id"] || parsed.engagement_id;
    const visitorEmail = parsed["visitorEmail"] || parsed.visitorEmail;
    const chat_transcript_plain_text = parsed["chat_transcript_plain_text"] || parsed.chat_transcript_plain_text;
    const hubspotToken = env.HUBSPOT_ACCESS_TOKEN

    const token = await getAuthorizationToken(env.GLIA_USER_API_KEY, env.GLIA_USER_SECRET);
    let hubspotContactId = "";
    if (custom_fields && custom_fields.hubspotContactId) {
      hubspotContactId = custom_fields.hubspotContactId;
    } else {
        if(visitorEmail)
        {
            const hubspotContactId = await hubspotLookForEmail(hubspotToken, visitorEmail)
            console.log("hubspotContactId: " + hubspotContactId);
        } else {
            hubspotContactId = "";
        }
    }

    const survey = await checkSurvey(token, engagement_id, env);

    if (survey) {
        const ticket = await createTicket(chat_transcript_plain_text, engagement_id, hubspotContactId, hubspotToken);

        console.log("Ticket: " + JSON.stringify(ticket));
    }

    return true;

}
export {
  onInvoke
};