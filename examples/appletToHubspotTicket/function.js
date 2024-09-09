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
  async function createTicket(subject, content, hubspotContactId, token) {
    console.log("Creating ticket");
    const endpoint = "crm/v3/objects/tickets";
    const body = {
      properties: {
        hs_pipeline_stage: 1,
        subject,
        content
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
  async function onInvoke(request, env) {
    const requestJson = await request.json();
    const parsed = JSON.parse(requestJson.payload);
    const subject = parsed.subject;
    const content = parsed.content;
    let hubspotContactId = parsed.hubspotContactId;
  
  
    const hubspotToken = env.HUBSPOT_ACCESS_TOKEN;
    
    if (hubspotContactId.includes("@")) {
      hubspotContactId = await hubspotLookForEmail(hubspotToken, hubspotContactId);
    }
  
    const ticket = await createTicket(subject, content, hubspotContactId, hubspotToken);
    if (ticket.id) {
      return new Response(JSON.stringify({ status: 201, ticketId: ticket.id }));
    } else {
      return new Response(JSON.stringify({ status: 500 }));
    }
  }
  export {
    onInvoke
  };
  