import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"; 

async function getTranscript(engagementId, credentials) {
    const HUMAN = "Human";
    const VA = "Assistant";
    const ENTER = '\n';
    const COLUMN = ": ";

    const urlUserToken = "https://api.glia.com/operator_authentication/tokens";
    const urlTranscript = `https://api.glia.com/engagements/${engagementId}/chat_transcript`;

    const userTokenPayload = credentials

    const headers = {
        "Accept": "application/vnd.salemove.v1+json",
        "Content-Type": "application/json"
    };

    const responseToken = await fetch(urlUserToken, { 
        method: 'POST', 
        body: JSON.stringify(userTokenPayload), 
        headers: headers 
    });
    const dataToken = await responseToken.json();
    
    const headersEngagement = {
        "accept": "application/vnd.salemove.v1+json",
        "authorization": `Bearer ${dataToken.token}`,
    };

    const response = await fetch(urlTranscript, { method: 'GET', headers: headersEngagement });
    const messages = await response.json();
    console.log("messages: ", messages);
    function formatMessage(message) {
        let senderType = message.sender.type;
        let sender = '';
        if (senderType === "operator") {
            sender = VA;
        } else if (senderType === "visitor") {
            sender = HUMAN;
        }
        return `${sender}${COLUMN}${message.message}`;
    }
    
    const formattedMessages = messages.map(formatMessage);
    const transcript = formattedMessages.join(ENTER);
    return transcript;
}

export async function onInvoke(request, env) {
  const { accessKeyId, secretAccessKey, modelId, api_key_secret, api_key_id, site_id } = env

  const requestJson = await request.json();
  const payload = JSON.parse(requestJson.payload);
  const maxResponseLength = payload.engine_settings.maxResponseLength
  const minInputLength = payload.engine_settings.minInputLength
  const background = payload.engine_settings.background
  const commandments = payload.engine_settings.commandments
  const engagementId = payload.engagement_id
  const utterance = payload.utterance
  
  const transcript = await getTranscript(engagementId, { api_key_secret, api_key_id, site_ids: [site_id] })
  let prompt = "\nHuman: \n " + background + ".\n "+ commandments +  ".\n "+ transcript+ ".\n "; 
  // let prompt = "\nHuman: \n " + background + ".\n " + commandments+ ".\n " + utterance + ".\n";

  prompt = prompt + ' Response needs to be '+ maxResponseLength + ' words or less. '+ "\nAssistant:";
  console.log("prompt: ", prompt)

  const config = {
    region: 'us-east-1',
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey 
    }
  }
  const client = new BedrockRuntimeClient(config);
  
  const inputBody = {
    prompt: prompt + ' \n Assistant: ',
    max_tokens_to_sample: 300,
    temperature: 1,
    top_k: 250,
    top_p: 0.999,
    stop_sequences: [ '\n\nHuman:' ],
    anthropic_version: 'bedrock-2023-05-31'
  }

  const input = { 
    body:  JSON.stringify(inputBody),
    contentType: "application/json",
    accept: "application/json",
    modelId: modelId || "anthropic.claude-v2" // required
  };

  const command = new InvokeModelCommand(input);
  const response = await client.send(command);
  
  const body = JSON.parse(Buffer.from(response.body))
  const completion = body.completion;
  console.log("completion: ", completion);
  const res =  { 
      "messages": [
          {
              "type": "suggestion",
              "content": completion
          }
      ],
      "confidence_level": 0.99
  };

  return new Response(JSON.stringify(res));
}

