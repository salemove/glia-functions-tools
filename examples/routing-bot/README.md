# Glia Routing Bot Example with Glia Functions

## Configuration

Update `queue-message.json` as needed and add to your virtual assistant queue in Glia as the Default Welcome Message

Update `function.js` with QUEUE ID and required responses

Install required modules to build your function: 

First - `npm install`
Second - `npm run build`

Use the Glia Functions CLI to deploy the `function-out.js` file to your Glia site  https://github.com/salemove/glia-functions-tools

Creating and deploying Glia Functions requires:
* Glia API key ID and secret
* Glia Site ID
