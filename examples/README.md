# Glia Functions Examples

This directory contains examples of Glia Functions demonstrating various integration patterns and use cases. Each example includes source code and documentation that can be used as a starting point for your own implementations.

## Available Examples

### iva-as-ivr
**Purpose:** Build an Intelligent Virtual Assistant with voice interactions.
**Features:**
- Voice interaction handling
- State machine implementation
- Queue management
- SMS integration

### genai
**Purpose:** Integrate Glia Functions with generative AI services.
**Features:**
- OpenAI API integration
- Chat completion implementation
- Handling AI responses within Glia

### bedrock-agent
**Purpose:** AWS Bedrock integration example.
**Features:**
- AWS Bedrock API integration
- AI agent capabilities
- Custom configurations

### s3-export
**Purpose:** AWS S3 data export capabilities.
**Features:**
- Secure file uploads to S3
- Data transformation before export
- AWS SDK integration

### teams-presence
**Purpose:** Microsoft Teams presence integration.
**Features:**
- Teams status synchronization
- Presence API integration
- Status mapping to Glia availability

### appletToHubspotTicket & surveyToHubspotTicket
**Purpose:** HubSpot integration examples.
**Features:**
- Converting Glia applet data to HubSpot tickets
- Survey response processing
- HubSpot API integration

### generativeAIBot
**Purpose:** AI-powered chatbot implementation.
**Features:**
- Natural language processing
- Conversational flows
- Integration with AI services

## How to Use These Examples

### Using the Interactive CLI (Recommended)

1. **Review the code:** Each example contains commented code explaining how the integration works.

2. **Start the interactive CLI:**
   ```bash
   # Recommended approach
   ./bin/glia-functions.js
   
   # Legacy approach (deprecated)
   node index.js
   ```

3. **Follow the menu options:**
   - Select "Manage & build functions"
   - Choose "Create new function" or "Manage existing functions" 
   - Follow the prompts to build, deploy, and test your function

4. **Configure environment variables:** When creating a new version, you'll be prompted to add custom environment variables if needed.

### Using Command-Line Scripts (Alternative)

1. **Build the example:**
   ```bash
   npm run build ./examples/example-name/function.js
   ```

2. **Deploy the function:**
   ```bash
   # Recommended approach
   node ./src/commands/createAndDeployVersion.js --id=your-function-id --path='./function-out.js'
   
   # Legacy approach (deprecated)
   node ./commands/createAndDeployVersion.js --id=your-function-id --path='./function-out.js'
   ```

3. **Configure environment variables:** Add them in JSON format:
   ```bash
   # Recommended approach
   node ./src/commands/createAndDeployVersion.js --id=your-function-id --path='./function-out.js' --env='{"API_KEY": "your_key"}'
   
   # Legacy approach (deprecated)
   node ./commands/createAndDeployVersion.js --id=your-function-id --path='./function-out.js' --env='{"API_KEY": "your_key"}'
   ```

4. **Test the function:**
   ```bash
   # Recommended approach
   node ./src/commands/invokeFunction.js --uri=your-function-uri
   
   # Legacy approach (deprecated)
   node ./commands/invokeFunction.js --uri=your-function-uri
   ```

## Creating Your Own Examples

When creating your own examples, consider following this structure:

```
examples/your-example-name/
├── function.js          # Main function code
├── README.md            # Documentation specific to this example
├── package.json         # If additional dependencies are needed
└── config/              # Optional configuration files
```

### Architecture Migration Note

The Glia Functions CLI is undergoing an architectural migration to improve code quality and maintainability. When developing new examples:

- Use the modern command paths (`./src/commands/` instead of `./commands/`)
- Use the unified API client when possible (`src/lib/api.js`)
- If you need utility functions, import them from `src/utils/` rather than `utils/`

For more details on the migration, see the [Architecture Migration Plan](../docs/architecture-migration.md).

## Internal Examples

Some examples in this directory are for internal testing and demonstration purposes only and are not intended for production use.
