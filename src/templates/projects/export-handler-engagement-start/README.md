# {{projectName}}

{{description}}

This project provides a handler for Glia engagement start export events using Glia Functions. It processes incoming webhook events when new engagements begin in the Glia platform, validates them against a schema, and allows for custom processing logic.

## Understanding Engagement Start Events

Engagement start events are triggered when a visitor begins a new engagement with your site. This could be:

- Starting a chat conversation
- Initiating an audio call
- Starting a video session
- Beginning a cobrowse session

These events contain valuable information about:

- The visitor and their attributes
- The context of the engagement (page URL, referrer, etc.)
- Routing information (queue)
- Timing data

## Features

- 🔍 **Schema Validation**: Validates incoming payloads against JSON schema
- 📤 **Event Forwarding**: Option to forward events to external services
- 🔒 **PII Filtering**: Option to automatically filter out PII data
- 🔄 **Retry Logic**: Built-in retry mechanism for external API calls
- 📊 **Logging**: Structured logging with configurable log levels

## Getting Started

### Prerequisites

- Node.js 14.x or later
- Glia Functions CLI (for deployment)

### Installation

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables by copying `.env.example` to `.env`:

```bash
cp .env.example .env
```

3. Edit `.env` to set your configuration:

```
# Debug settings
DEBUG=false
LOG_LEVEL=info

# Forwarding settings
FORWARDING_URL=https://your-service.example.com/webhook
API_KEY=your-api-key

# Data handling
FILTER_PII=true
```

### Local Development

To run the function locally for testing:

```bash
npm run dev
```

This starts a local server that you can use to test the function. You can send test requests using the included sample payload:

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d @schemas/engagement-start-sample.json
```

### Testing

Run the tests to verify functionality:

```bash
npm test
```

### Deployment

Deploy the function to Glia Functions:

```bash
npm run deploy
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DEBUG | Enable debug logging | false |
| LOG_LEVEL | Log level (debug, info, warn, error) | info |
| FORWARDING_URL | URL to forward events to | - |
| API_KEY | API key for forwarding | - |
| FILTER_PII | Filter out PII data | true |

### Payload Schema

The function validates incoming payloads against the JSON schema located in `schemas/engagement-start-schema.json`.

### Engagement Start Payload

Here's an example of an engagement start event payload:

```json
{
  "id": "e0b5d9c6-4f4b-4c9a-8f3a-1d4e88cb0cad",
  "visitor_id": "v_12345678",
  "site_id": "site_87654321",
  "engagement_type": "chat",
  "context": {
    "page_url": "https://example.com/support",
    "page_title": "Customer Support | Example Company",
    "queue_id": "q_9876543",
    "queue_name": "General Support"
  },
  "created_at": "2023-09-15T14:30:22Z",
  "visitor": {
    "email": "visitor@example.com",
    "name": "John Doe",
    "phone": "+15551234567",
    "first_name": "John",
    "last_name": "Doe",
    "custom_attributes": {
      "account_type": "premium",
      "account_number": "ACCT-123456",
      "loyalty_tier": "gold"
    }
  },
  "metadata": {
    "origin": "website_chat_button",
    "browser": "Chrome",
    "device": "desktop",
    "os": "Windows"
  }
}
```

## Customizing

To customize the function for your specific requirements:

1. Modify the `processEngagementStart` function in `function.js`
2. Add additional utility functions as needed
3. Update environment variables for your use case
4. Extend the schema if additional validation is required

## Common Use Cases

- Notifying internal systems about new engagements
- Recording engagement start metrics
- Triggering automated processes when engagements begin
- Enriching visitor data from external systems
- Routing analytics to data warehouses

## License

This project is licensed under the MIT License - see the LICENSE file for details.