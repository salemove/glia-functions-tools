# glia functions tools

Helper functions and examples to assist with building with Glia Functions

a work-in-progress 

## Environment variables

* GLIA_KEY_ID
* GLIA_KEY_SECRET
* GLIA_SITE_ID

## Build your code for Glia Functions

Build the function: `npm run build`

## How to use the CLI
1. Clone repo and install dependencies `npm install`
2. Run CLI `node .`

## How to use the scripts

### List existing functions

```
node ./commands/listFunctions.js
```

### Create and deploy a new function version

```
node ./commands/createAndDeployVersion.js --id=$FUNCTION_ID --path='./function-out.js' --env='{"test"
: "test"}'
```

### Invoke a function

```
 node ./commands/invokeFunction.js --uri=$INVOCATION_URI
```
