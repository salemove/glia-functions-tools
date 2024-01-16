import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"; // ES Modules import

export async function onInvoke(request, env) {
  const { ACCESS_KEY_ID, SECRET_ACCESS_KEY  } = env
  const config = {
    region: 'us-east-1',
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY
    }
  }

  const client = new BedrockRuntimeClient(config);

  const inputBody = {
    prompt: 'Human: my name is carlos, what is Glia? \n Assistant: ',
    max_tokens_to_sample: 300,
    temperature: 1,
    top_k: 250,
    top_p: 0.999,
    stop_sequences: [ '\n\nHuman:' ],
    anthropic_version: 'bedrock-2023-05-31'
  }

  const input = { // InvokeModelRequest
    body:  JSON.stringify(inputBody),
    contentType: "application/json",
    accept: "application/json",
    modelId: "anthropic.claude-v2", // required
  };

  const command = new InvokeModelCommand(input);
  const response = await client.send(command);
  
  const body = JSON.parse(Buffer.from(response.body))
  return new Response(JSON.stringify(body));
}