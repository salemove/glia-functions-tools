# glia functions tools

Helper functions and examples to assist with building with Glia Functions

a work-in-progress 

## Environment variables

* GLIA_KEY_ID
* GLIA_KEY_SECRET
* GLIA_SITE_ID

## How to use

### Build your code for Glia Functions

Build the function: `npm run build`

### List existing functions

```
node ./commands/listFunctions.js
```

### Create and deploy a new function version

```
node ./commands/createAndDeployVersion.js --id=$FUNCTION_ID --path='./function-out.js' --env='{"test"
: "test"}'
```

### Lazy developer's function to create a function and create and deploy a version

Use the example script to create a function, version, and deploy: `node index.js --file=function-out.js`

### Invoke a function

```
 node ./commands/invokeFunction.js --uri=$INVOCATION_URI
```