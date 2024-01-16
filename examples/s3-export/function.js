import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export async function onInvoke(request, env) {
    try{
        const requestJson = await request.json();
        const payload = JSON.parse(requestJson.payload);
        const client = new S3Client({
          region: 'us-east-1',
          credentials: {
            accessKeyId: env.ACCESS_KEY_ID,
            secretAccessKey: env.SECRET_ACCESS_KEY
          }
        });
        const command = new PutObjectCommand({
          Bucket: "christian-glia",
          Key: "01test.json",
          Body: JSON.stringify(payload),
        });
        const response = await client.send(command);
        console.log(response);
        return new Response(JSON.stringify({
            input: payload,
            output: response
        }));
    } catch(e) { 
        console.log(e); 
        return new Response(JSON.stringify({ error: e }))
    };
}