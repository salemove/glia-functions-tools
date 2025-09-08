# {{projectName}}

{{description}}

This project demonstrates how to use KV Store in Glia Functions for persistent data storage across function invocations. KV Store provides a key-value database that can be used to store and retrieve data that needs to persist between function calls.

## Features

- Complete REST API for KV Store operations
- Comprehensive error handling
- Unit tests with KV Store mocking
- Examples of all KV Store operations:
  - Get/Set/Delete operations
  - List all keys with optional prefix filtering
  - Conditional updates with test-and-set
  - Batch operations for efficiency

## Getting Started

### Prerequisites

- Glia Functions CLI installed (`npm install -g @glia/functions-tools`)
- Node.js 14.x or higher

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Copy environment variables:

```bash
cp .env.example .env
```

4. Update `.env` file with your settings

### Testing Locally

Run the development server:

```bash
npm run dev
```

This will start a local server at http://localhost:8787 where you can test your function.

### Running Tests

```bash
npm test
```

## KV Store API Reference

The function implements a REST API for KV Store operations:

### GET Operations

#### Get a value

```
GET /?key=your-key
GET /get?key=your-key
```

Response:
```json
{
  "success": true,
  "key": "your-key",
  "value": "your-value",
  "expires": null
}
```

#### List all values

```
GET /list
```

With optional prefix filtering:
```
GET /list?prefix=user_
```

With optional limit:
```
GET /list?limit=10
```

Response:
```json
{
  "success": true,
  "count": 2,
  "items": [
    {
      "key": "key1",
      "value": "value1",
      "expires": null
    },
    {
      "key": "key2",
      "value": "value2",
      "expires": 1621234567890
    }
  ]
}
```

### POST Operations

#### Set a value

```
POST /set
```

Body:
```json
{
  "key": "your-key",
  "value": "your-value",
  "ttl": 3600
}
```

Response:
```json
{
  "success": true,
  "key": "your-key",
  "value": "your-value",
  "expires": 1621234567890
}
```

#### Test and Set (Conditional Update)

```
POST /test-and-set
```

Body:
```json
{
  "key": "your-key",
  "oldValue": "current-value",
  "newValue": "new-value",
  "ttl": 3600
}
```

Response if condition is met:
```json
{
  "success": true,
  "conditionMet": true,
  "key": "your-key",
  "value": "new-value",
  "expires": 1621234567890
}
```

Response if condition is not met:
```json
{
  "success": false,
  "conditionMet": false,
  "message": "Condition not met, value was not updated"
}
```

#### Batch Operations

```
POST /batch
```

Body:
```json
{
  "operations": [
    { "op": "set", "key": "key1", "value": "value1" },
    { "op": "get", "key": "key2" },
    { "op": "test-and-set", "key": "key3", "oldValue": "old", "newValue": "new" },
    { "op": "delete", "key": "key4" }
  ]
}
```

Response:
```json
{
  "success": true,
  "results": [
    {
      "key": "key1",
      "value": "value1",
      "expires": null
    },
    {
      "key": "key2",
      "value": "value2",
      "expires": null
    },
    {
      "key": "key3",
      "value": "new",
      "expires": null
    },
    {
      "key": "key4",
      "deleted": true
    }
  ]
}
```

### DELETE Operations

#### Delete a value

```
DELETE /?key=your-key
DELETE /delete?key=your-key
```

Response:
```json
{
  "success": true,
  "key": "your-key",
  "deleted": true
}
```

## Common Use Cases

### Session Storage

```javascript
// Store session data
await kvStore.set({
  key: `session_${sessionId}`,
  value: { userId: 123, lastAccess: Date.now() },
  expirationTtl: 3600 // 1 hour TTL
});

// Retrieve session data
const session = await kvStore.get(`session_${sessionId}`);
```

### Caching

```javascript
// Try to get cached value
const cachedData = await kvStore.get(`cache_${key}`);
if (cachedData && cachedData.value) {
  return cachedData.value;
}

// If not found, compute the value
const computedValue = await expensiveOperation();

// Store in cache with TTL
await kvStore.set({
  key: `cache_${key}`,
  value: computedValue,
  expirationTtl: 300 // 5 minutes
});

return computedValue;
```

### Rate Limiting

```javascript
// Get current rate limit counter
const rateLimit = await kvStore.get(`ratelimit_${userId}`);
const currentCount = rateLimit?.value?.count || 0;

if (currentCount >= MAX_REQUESTS_PER_MINUTE) {
  throw new Error('Rate limit exceeded');
}

// Increment counter
await kvStore.set({
  key: `ratelimit_${userId}`,
  value: { count: currentCount + 1 },
  expirationTtl: 60 // Reset after 1 minute
});
```

## Best Practices

1. **Use namespaces effectively**: Organize your KV store by using consistent key prefixes or namespaces
2. **Implement proper error handling**: Always handle potential errors from KV Store operations
3. **Set appropriate TTL values**: Use TTLs to automatically expire data that shouldn't live forever
4. **Batch operations when possible**: Use batch operations to reduce latency and improve performance
5. **Use test-and-set for concurrent modifications**: Prevent race conditions by using test-and-set operations

## Deployment

To deploy this function to Glia:

```bash
npm run deploy
```

Or deploy manually with the CLI:

```bash
npm run build
glia-functions create-version --function-id YOUR_FUNCTION_ID --path ./function-out.js --deploy
```

## Further Reading

- [Glia Functions Documentation](https://docs.glia.com/functions)
- [KV Store API Reference](https://docs.glia.com/functions/kv-store)

## License

This project is licensed under the MIT License - see the LICENSE file for details.