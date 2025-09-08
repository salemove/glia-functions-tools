# {{projectName}}

{{description}}

This project provides a handler for Glia export events using Glia Functions. It processes incoming webhook events from Glia's export system, validates them against a predefined schema, and allows for custom processing logic.

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

This starts a local server that you can use to test the function. You can send test requests using the included sample payloads:

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d @schemas/{{eventType}}-sample.json
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

The function validates incoming payloads against a JSON schema located in `schemas/{{eventType}}-schema.json`.

## Customizing

To customize the function for your specific requirements:

1. Modify the `processEvent` function in `function.js`
2. Add additional utility functions as needed
3. Update environment variables for your use case
4. Extend the schema if additional validation is required

## Export Event Types

Glia provides several types of export events:

- **engagement-start**: Triggered when a new engagement begins
- **engagement-end**: Triggered when an engagement ends
- **engagement-transfer**: Triggered when an engagement is transferred
- **presence-update**: Triggered when a user's presence status changes

### Event Schemas

All event schemas use JSON Schema Draft-07 and include versioning with a `version` field. 

#### Base Schema

All event types extend a common base schema that includes these required fields:
- `version`: Schema version (e.g., "v1")
- `export_type`: Type of export event
- `site_id`: Unique identifier for the site

#### Engagement Start Event

The engagement start event (`export_type: "engagement_start"`) contains:
- `engagement_id`: Unique identifier for the engagement
- `operator`: Information about the operator handling the engagement
- `platform`: The Glia platform variant handling this engagement
- `queue_wait_time`: Time in seconds the visitor waited in queue
- `queues`: Queues the engagement was routed through
- `source`: Source of the engagement (button_embed, chat_embed, etc.)
- `visitor`: Information about the visitor

#### Engagement End Event

The engagement end event (`export_type: "engagement"`) contains:
- `engagement`: Core engagement information (id, duration, timestamps)
- `visitor`: Enhanced visitor information
- `site`: Site information
- `operators`: List of operators who participated
- `audio_used`: Whether audio was used during the engagement
- `video_used`: Whether video was used during the engagement
- `cobrowsing_used`: Whether cobrowsing was used
- `chat_transcript`: Optional array of structured chat messages with attachments

#### Engagement Transfer Event

The engagement transfer event (`export_type: "engagement_transfer"`) contains:
- `engagement_id`: Unique identifier for the engagement
- `operator`: Information about the operator handling the transfer
- `source`: Source of the engagement
- `visitor`: Information about the visitor

#### Presence Update Event

The presence update event (`action: "user_presence_update"`) has a unique structure:
- `sent_at`: ISO timestamp when the update was sent
- `events`: Array of presence events containing:
  - `user_id`: Unique identifier for the user
  - `user_email`: Email address of the user
  - `status`: User status information (value, changed_at)
  - `capacity`: User media capabilities
  - `availability`: Overall availability status
  - `activity`: Current user activity and interactions
  - `account_id`: Account identifier

## License

This project is licensed under the MIT License - see the LICENSE file for details.