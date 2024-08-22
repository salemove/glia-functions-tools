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

async function createTicket(subject, content, hubspotContactId, token) {
    console.log("Creating ticket");

    const endpoint = "crm/v3/objects/tickets";
    
    const body = {
        properties: {
            hs_pipeline_stage: 1,
            subject: subject,
            content: content
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

async function onInvoke(request, env) {
    const requestJson = await request.json();
    const parsed = JSON.parse(requestJson.payload);
    // parsed contains information passed through the webhook
    const subject = parsed.subject;
    const content = parsed.content;
    let hubspotContactId = parsed.hubspotContactId;

    const hubspotToken = env.HUBSPOT_ACCESS_TOKEN

    if(hubspotContactId.includes("@"))
    {
        hubspotContactId = await hubspotLookForEmail(hubspotToken, hubspotContactId);
    }

    const ticket = await createTicket(subject, content, hubspotContactId, hubspotToken);
    if(ticket.id)
    {
        return new Response(JSON.stringify({ status: 201, ticketId: ticket.id }));
    } else {
        return new Response(JSON.stringify({ status: 500 }));
    }
}
export {
  onInvoke
};