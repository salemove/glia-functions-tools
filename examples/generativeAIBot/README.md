# Generative AI Bot Example

This example demonstrates how to build an AI-powered chatbot using Glia Functions and external generative AI services.

## Overview

The Generative AI Bot integrates with large language models (like GPT-4, Claude, etc.) to provide intelligent, conversational responses to visitor queries. This function handles the entire interaction flow:

1. Receiving messages from visitors
2. Processing and contextualizing the messages
3. Sending them to an AI service
4. Returning the AI-generated responses back to the visitor

## Implementation

The implementation consists of several key components:

### 1. Function Handler

The main entry point that processes incoming requests, validates them, and orchestrates the response generation.

### 2. Conversation Management

Maintains conversation history and context across multiple interactions to ensure the AI has appropriate context for generating responses.

### 3. AI Service Integration

Handles communication with external AI providers, sending prompts and receiving generated responses.

### 4. Response Formatting

Processes AI-generated text to ensure it's properly formatted for display in the chat interface.

## Prerequisites

Before running the code, make sure you have the following:

- Access to the Glia API
- API key ID and API key secret for authentication
- Environment variables GLIA_USER_API_KEY and GLIA_USER_SECRET configured with the appropriate values
- Understanding of Glia Functions
- Generative AI API Access (OpenAI API Schema)

## Configuration

To use this function, you'll need to configure the following environment variables:

```json
{
  "AI_API_KEY": "your-api-key-here",   // API key for the AI service
  "AI_ENDPOINT": "https://api.openai.com/v1/chat/completions", // API endpoint
  "AI_MODEL": "gpt-4",                 // Model to use
  "AI_PERSONALITY": "You are a helpful customer service assistant for Acme Corp. Be concise and friendly."
}
```

## Setup Instructions

1. **Environment Variables Setup**:
   - Set `GLIA_USER_API_KEY`: API key ID for authentication
   - Set `GLIA_USER_SECRET`: API key secret for authentication

2. **Function Configuration**:
   - Add the Function to AI Engine in Glia
   - Configure the required parameters:
     - `AI_API_KEY`
     - `AI_ENDPOINT`
     - `AI_MODEL`
     - `AI_PERSONALITY`

3. **Deployment**:
   - Deploy the function using the Glia Functions CLI
   - Configure it to be triggered by visitor messages

## Documentation Resources

For more information, see the official Glia documentation:

- [Writing and Deploying Glia Functions](https://docs.glia.com/glia-how-to/docs/writing-and-deploying-glia-functions)
- [Connecting Glia Functions to AI Engines](https://docs.glia.com/glia-how-to/docs/connecting-glia-functions-to-ai-engines)

## Advanced Features

### Knowledge Base Integration

The bot can be enhanced to reference a custom knowledge base by modifying the AI personality prompt to include specific domain knowledge.

### Response Templates

You can define custom personalities for different use cases by changing the `AI_PERSONALITY` parameter.

### Conversation Routing Logic

The function can be extended to implement logic that determines when a conversation should be routed to a human operator.

## Integration with Glia Platform

This bot integrates with the Glia platform to:

- Receive visitor messages through the Glia chat interface
- Send AI-generated responses back to visitors
- Maintain conversation context throughout the engagement

## Testing the Bot

To test this function:

1. Configure the required environment variables
2. Deploy the function to your Glia Functions environment
3. Associate the function with an AI engine in the Glia platform
4. Start a chat session and observe the AI responses