# {{projectName}}

{{description}}

## Overview

This is a Glia Function project created using the basic function template.

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

2. Create the function in Glia:
   ```
   npm run create
   ```
   Note: Save the function ID returned by this command.

3. Update the function ID in your `.env` file:
   ```
   FUNCTION_ID=your-function-id
   ```

### Development Workflow

1. Edit `function.js` to implement your logic

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

## Configuration

Function configuration is managed through environment variables in your `.env` file or profile configuration.

## Testing

Write tests in the `test/` directory and run:

```
npm test
```

## Deployment

This project includes npm scripts for deploying to Glia:

```
npm run deploy
```

## License

MIT