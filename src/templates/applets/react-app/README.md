# {{appletName}}

{{description}}

## Overview

This is a React-based applet for the Glia platform that includes both a frontend UI and backend function.

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Glia Functions CLI

### Setup

1. Install dependencies:
   ```
   npm install
   ```
   or
   ```
   yarn
   ```

2. Start the development server:
   ```
   npm start
   ```
   or
   ```
   yarn start
   ```

3. Build for production:
   ```
   npm run build
   ```
   or
   ```
   yarn build
   ```

## Project Structure

- `/public` - Static assets and index.html
- `/src` - React application source code
  - `/components` - React components
  - `/hooks` - Custom React hooks
  - `/utils` - Utility functions
- `function.js` - Backend function for processing requests
- `build-script.js` - Script for post-processing build output

## Deployment

### Deploy the Applet

1. Build the project:
   ```
   npm run build
   ```

2. The build process will create an `applet.html` file in the root directory which contains the bundled React app.

3. Use the Glia Functions CLI to deploy the applet:
   ```
   glia-functions deploy-applet --path ./applet.html --name "{{appletName}}"
   ```

### Deploy the Function

Deploy the function using the Glia Functions CLI:

```
glia-functions deploy --path ./function.js
```

## Backend Function

The backend function (`function.js`) handles requests from the frontend applet. It exports an `onInvoke` function that processes incoming requests and returns responses.

## Frontend Integration

The frontend uses the Glia Axon API to communicate with the backend function. See `src/utils/api.js` for the integration code.

{{#if authorName}}## Author

{{authorName}}{{/if}}