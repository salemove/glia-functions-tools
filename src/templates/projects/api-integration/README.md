# {{projectName}}

{{description}}

## Overview

This is a Glia Function project created using the API integration template. It provides a robust foundation for building API integrations with:

- Secure authentication handling
- Input validation
- Error handling with appropriate status codes
- Request timeouts
- Rate limiting awareness
- Consistent response formatting

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- A Glia account with API access
- Glia Functions CLI installed

### Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Configure your API credentials:
   ```
   cp .env.example .env
   ```
   
   Edit `.env` to add your API key and other required credentials.

3. Create the function in Glia:
   ```
   npm run create
   ```
   Note: Save the function ID returned by this command.

4. Update the function ID in your `.env` file:
   ```
   FUNCTION_ID=your-function-id
   ```

### Development Workflow

1. Edit files to implement your API integration logic:
   - `function.js` - Main function handler
   - `lib/api-client.js` - API client implementation
   - `lib/validator.js` - Input validation logic

2. Build the function:
   ```
   npm run build
   ```

3. Deploy the function:
   ```
   npm run deploy
   ```

4. Test the function:
   ```
   npm run invoke
   ```

5. View logs:
   ```
   npm run logs
   ```

## API Client Usage

The included API client handles common API integration requirements:

```javascript
import { makeApiRequest } from './lib/api-client.js';

// Make an API request
const response = await makeApiRequest({
  url: 'https://api.example.com/endpoint',
  method: 'POST',
  apiKey: env.API_KEY,
  payload: { 
    query: 'search term'
  },
  timeout: 5000
});
```

## Configuration

Function configuration is managed through environment variables in your `.env` file or profile configuration:

- `API_KEY` - Your API authentication key
- `API_URL` - The API base URL
- `API_TIMEOUT` - Request timeout in milliseconds (default: 5000)

## Testing

Write tests in the `test/` directory and run:

```
npm test
```

### API Testing

Test against the actual API:

```
npm run test:api
```

## License

MIT