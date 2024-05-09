// function.js

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
          process.exit(1);
      }
  } catch (error) {
      console.error('Error while fetching authorization token:', error);
      process.exit(1);
  }
}

async function fetchMessageHistory(token, engagementId) {
  
  
  const url = `https://api.glia.com/engagements/${engagementId}/chat_transcript`;
  const headers = {
      'Accept': 'application/vnd.salemove.v1+json',
      'Authorization': `Bearer ${token}`,
  };
  
  try {
      const response = await fetch(url, { headers: headers });
      const data = await response.json();

      return data;
  } catch (error) {
      console.error('Error while fetching message history:', error);
      process.exit(1);
  }
}

async function fetchTransferType(token, engagementId) {

  const url = `https://api.glia.com/engagements/${engagementId}`;
  const headers = {
    "Accept": "application/vnd.salemove.v1+json",
    "Authorization": `Bearer ${token}`
  };
  try {
    const response = await fetch(url, { headers });
    const data = await response.json();
    if(data.source=="offline_phone"){
        return "audio";
    } else {
        return "text";
    }
  } catch (error) {
    console.error("Error while fetching transfer type:", error);
    process.exit(1);
  }
}
async function onInvoke(request, env) {
    const jsonData = await request.json();
    
    const { invoker, payload } = jsonData;

    const parsed = JSON.parse(payload);

    const OPENAI_API_KEY = parsed.engine_settings.OPENAI_API_KEY;

    const personality = parsed.engine_settings.personality;

    const token = await getAuthorizationToken(env.GLIA_USER_API_KEY, env.GLIA_USER_SECRET);

    let fullPrompt = [
      {
        role: "system",
        content: personality
      }
    ];
    const message_history = await fetchMessageHistory(token, parsed.engagement_id);

    for (let i = 0; i < message_history.length; i++) {
      if (message_history[i].sender.type === "operator") {
        fullPrompt.push({role: "assistant", content: message_history[i].message});
      } else if (message_history[i].sender.type === "visitor") {
        fullPrompt.push({role: "user", content: message_history[i].message});
      }
    }

    fullPrompt.push({role: "user", content: parsed.utterance});

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: fullPrompt,
        temperature: 0.7
      })
    });
    const data = await response.json();
    console.error("Response data:", data);
    const responseText = data.choices[0].message.content;
    console.log("Response text:", responseText);

    if(responseText.includes("DONE")) {
      console.log("Transferring to Queue ID:", parsed.engine_settings.QUEUE_ID);
      const transferType = await fetchTransferType(token, parsed.engagement_id);
      console.log("Transfer Type:", transferType);
      const transfer = {        
        "type": "transfer",
          "properties": {
            "version": "0",
            "media": transferType,
            "queue_id": parsed.engine_settings.QUEUE_ID,
            "notifications": {
              "success": "I am transferring you to one of our operators, please wait",
              "failure": "I can't transfer you, the service is unavailable",
              "queue_closed": "I can't transfer you, the queue is closed at the moment"
            }
          }
        }
      return Response.json({
        messages: [transfer],
        confidence_level: 1
      });
    } else {
      return Response.json({
        messages: [{ type: "suggestion", content: responseText }],
        confidence_level: 1
      });
    }
}
export {
  onInvoke
};