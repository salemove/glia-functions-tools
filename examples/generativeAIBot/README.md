# Generative AI Bot
This code contains a generative AI bot that responds to user inputs. The bot uses an external AI model to generate responses based on the user's messages and the conversation history.

## Prerequisites
Before running the code, make sure you have the following:

- Access to the Glia API
- API key ID and API key secret for authentication
- Environment variables GLIA_USER_API_KEY and GLIA_USER_SECRET configured with the appropriate values
- Understanding of Glia Functions
- Generative AI API Access (OpenAI API Schema)


## Read the Docs
https://docs.glia.com/glia-how-to/docs/writing-and-deploying-glia-functions

https://docs.glia.com/glia-how-to/docs/connecting-glia-functions-to-ai-engines

## Setup

### Set the environment variables:

GLIA_USER_API_KEY: API key ID for authentication
GLIA_USER_SECRET: API key secret for authentication

### Usage

- Add the Function to AI Engine
- Parameters need to contain:
    - AI_API_KEY
    - AI_ENDPOINT
    - AI_MODEL
    - AI_PERSONALITY
