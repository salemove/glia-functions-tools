# HubSpot Ticket Creation API Integration

This project integrates with HubSpot and Glia APIs to automate the ticket creation process based on survey responses from Glia engagements. The main functions include checking survey answers, looking up HubSpot contacts by email, and creating HubSpot tickets related to the contact if found.

## Features

- **Authentication**: Retrieve an access token needed for API calls.
- **Search for HubSpot Contacts**: Lookup contacts in HubSpot CRM by email address or custom attributes.
- **Create HubSpot Tickets**: Create tickets in HubSpot based on engagement history.
- **Survey Check**: Check survey answers to determine if a ticket should be created.

## Prerequisites

Before using this code, ensure you have:

- A valid HubSpot account and access to the API.
- A Glia account with the necessary User API keys and secrets.
- Node.js and an environment supporting ECMAScript Modules (ESM) to allow `import` and `export` syntax.

Note: You should be familiar with Glia Functions before proceeding. 

## Installation

1. Clone the repository or download the code files.
2. Install any required dependencies (if additional packages are not already included).
3. Update `.env` or configuration settings with your API keys and tokens:

   ```plaintext
   GLIA_USER_API_KEY=your_glia_user_api_key
   GLIA_USER_SECRET=your_glia_user_secret
   HUBSPOT_ACCESS_TOKEN=your_hubspot_access_token
   SURVEY_QUESTION=Open a Hubspot Ticket?
   ```

See Usage for more details.

## Functions

### 1. `getAuthorizationToken(apiKeyId, apiKeySecret)`

Retrieves an authorization token to interact with Glia API.

**Parameters:**

- `apiKeyId`: Your Glia API Key ID.
- `apiKeySecret`: Your Glia API Key Secret.

**Returns**: A string containing the authorization token.

### 2. `hubspotLookForEmail(token, email)`

Searches for a HubSpot <strong>contact</strong> by email.

**Parameters:**

- `token`: The authorization token for HubSpot API.
- `email`: The email to search for.

**Returns**: The ID of the HubSpot contact or `false` if not found.

### 3. `apiCall(endpoint, method, body, token)`

Makes a generic API call to the specified endpoint using the given method and body.

**Parameters:**

- `endpoint`: The API endpoint.
- `method`: HTTP method (GET, POST, etc.).
- `body`: Request body, if applicable (for POST, PUT, etc.).
- `token`: The authorization token for the API.

**Returns**: Response data in JSON format.

### 4. `createTicket(engagementHistory, engagementId, hubspotContactId, token)`

Creates a new ticket in HubSpot CRM.

**Parameters:**

- `engagementHistory`: Transcript of the engagement.
- `engagementId`: The ID of the engagement.
- `hubspotContactId`: The ID of the HubSpot contact associated with this ticket (if available).
- `token`: The authorization token for HubSpot API.

**Returns**: Created ticket data or `false` on failure.

### 5. `checkSurvey(token, engagementId, env)`

Checks the survey answers for a specific engagement to see if a ticket should be created.

**Parameters:**

- `token`: The authorization token for Glia API.
- `engagementId`: The ID of the engagement.
- `env`: Environment variables containing configuration data.

**Returns**: `true` if the survey indicates a ticket should be created, `false` otherwise.

### 6. `onInvoke(request, env)`

Main function that processes incoming requests, checks surveys, searches for contacts, and creates tickets if needed.

**Parameters:**

- `request`: The incoming request containing engagement information.
- `env`: Environment variables containing access tokens and configuration.

**Returns**: `true` indicating the process has been invoked.

## Usage

- Create a Survey Question asking if a ticket should be submitted. It should be a boolean question (Yes/No)
- Add Survey Question to the Operator Survey
- Update your .env file with the information in Installation guide above
- Create a new function (See: <a href="https://docs.glia.com/glia-dev/docs/glia-functions">Glia Functions Documentation</a>)
- Gather the invocation uri from the create function (See: <a href="https://docs.glia.com/glia-how-to/docs/writing-and-deploying-glia-functions">Writing and Deploying Glia Functions</a>)
- Create an Export in Glia Hub (See: <a href="https://docs.glia.com/glia-how-to/docs/connecting-glia-functions-to-exports#step-3-configure-an-export">Setting up Glia Functions in Exports</a>)


## Error Handling

The code contains basic error handling, including logging for:

- Network errors during API calls.
- Missing engagement IDs.
- Unsuccessful ticket creation or contact lookup.

Make sure to monitor logs to diagnose any issues that may arise during execution.

## License

This project is licensed under the MIT License.

## Contributing

Feel free to fork the repository, make improvements, and create pull requests for any enhancements or bug fixes. Please ensure that your code adheres to the style of the existing codebase.

## Support

This code is not for production use, using this is using at your own risk. Glia Technologies, Inc takes no responsibility for supporting this or any example functions in the repository