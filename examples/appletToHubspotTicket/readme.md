# HubSpot API Integration

This repository provides a set of asynchronous functions to interact with the HubSpot API. It includes functionalities to create tickets and search for contacts based on email. This code is designed to be used in a serverless environment, making it easy to handle webhook requests and API calls seamlessly.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Functions](#functions)
  - [apiCall](#apicall)
  - [createTicket](#createticket)
  - [hubspotLookForEmail](#hubspotlookforemail)
  - [onInvoke](#oninvoke)
- [Error Handling](#error-handling)
- [Environment Variables](#environment-variables)
  
## Installation

To use this code, you need to set up a JavaScript environment that supports async/await syntax. You can run this code in a serverless function platform such as a Glia Function.

### Prerequisites

- A valid HubSpot account and access to the API.
- A Glia account with the necessary rights to add Applets.
- Node.js and an environment supporting ECMAScript Modules (ESM) to allow `import` and `export` syntax.


## Usage

To use the integrated functions, you must invoke the `onInvoke` function with an HTTP request that includes a JSON payload containing ticket details. The function will handle creating a ticket and respond with the appropriate status.

## Functions

### `apiCall(endpoint, method, body, token)`

Makes a request to the HubSpot API.

**Parameters:**
- `endpoint` (string): The specific API endpoint to call.
- `method` (string): HTTP method e.g., "GET", "POST".
- `body` (object): Data to be sent in the request body (for non-GET requests).
- `token` (string): Bearer token for authentication.

**Returns:** 
- A promise that resolves to the JSON response from the API.

### `createTicket(subject, content, hubspotContactId, token)`

Creates a new ticket in HubSpot.

**Parameters:**
- `subject` (string): The subject of the ticket.
- `content` (string): The content of the ticket.
- `hubspotContactId` (string): The ID of the associated HubSpot contact (optional).
- `token` (string): Bearer token for authentication.

**Returns:**
- A promise resolving to the created ticket data or `false` on failure.

### `hubspotLookForEmail(token, email)`

Searches for a HubSpot contact based on the provided email.

**Parameters:**
- `token` (string): Bearer token for authentication.
- `email` (string): The email to search for.

**Returns:**
- A promise that resolves to the contact ID if the email exists, or `false` if not found.

### `onInvoke(request, env)`

Handles the HTTP request and triggers the ticket creation process.

**Parameters:**
- `request` (object): The incoming request object.
- `env` (object): Environment variables containing the HubSpot access token.

**Returns:**
- An HTTP response indicating the status of the ticket creation.

## Error Handling

The code includes basic error handling via console logs to help diagnose issues arising during API calls. Network errors and data retrieval failures will be logged for easier troubleshooting.

## Environment Variables

The following environment variable is required for the functions to operate correctly:

- `HUBSPOT_ACCESS_TOKEN`: Your HubSpot API access token, which is used for API authentication.

## License

This project is licensed under the MIT License.

## Support

This code is not for production use, using this is using at your own risk. Glia Technologies, Inc takes no responsibility for supporting this or any example functions in the repository