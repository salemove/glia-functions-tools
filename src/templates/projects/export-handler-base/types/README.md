# Glia Export Event TypeScript Definitions

This directory contains TypeScript definitions for Glia export event payloads. These definitions provide type safety when working with export events in TypeScript projects.

## Using TypeScript Definitions

To use these definitions in your project:

1. Make sure TypeScript is installed in your project:
   ```bash
   npm install --save-dev typescript
   ```

2. Import the types in your code:
   ```typescript
   import type { EngagementStartEvent } from './types/engagement-start';
   
   // Or use the combined exports type
   import type { ExportEvent, ExportEventTypeMap } from './types/exports';
   ```

3. Use the types in your functions:
   ```typescript
   export async function onInvoke(request: Request, env: Env): Promise<Response> {
     try {
       const requestJson = await request.json();
       const data = JSON.parse(requestJson.payload) as EngagementStartEvent;
       
       // TypeScript will now provide type checking and autocompletion for the data object
       console.log(`Processing engagement ${data.id} for visitor ${data.visitor_id}`);
       
       // ...
     } catch (error) {
       // ...
     }
   }
   ```

## Generic Export Event Handler

You can use the combined type definitions for a generic export event handler:

```typescript
import type { ExportEvent, ExportEventTypeMap } from './types/exports';

export async function processEvent<T extends keyof ExportEventTypeMap>(
  eventType: T, 
  data: ExportEventTypeMap[T]
): Promise<void> {
  switch (eventType) {
    case 'engagement-start':
      // TypeScript knows this is an EngagementStartEvent
      console.log(`New engagement started: ${data.id}`);
      break;
    case 'engagement-end':
      // TypeScript knows this is an EngagementEndEvent
      console.log(`Engagement ended: ${data.id}, duration: ${data.duration}s`);
      break;
    case 'engagement-transfer':
      // TypeScript knows this is an EngagementTransferEvent
      console.log(`Engagement transferred: ${data.id} from ${data.source.type} to ${data.destination.type}`);
      break;
    case 'presence-update':
      // TypeScript knows this is a PresenceUpdateEvent
      console.log(`Operator ${data.operator_id} status changed to ${data.status}`);
      break;
  }
}
```

## Available Type Definitions

- **Common Types** (`index.d.ts`): Shared interfaces used across all export events
- **Engagement Start** (`engagement-start.d.ts`): Type definitions for engagement start events
- **Engagement End** (`engagement-end.d.ts`): Type definitions for engagement end events
- **Engagement Transfer** (`engagement-transfer.d.ts`): Type definitions for engagement transfer events
- **Presence Update** (`presence-update.d.ts`): Type definitions for presence update events
- **Combined Exports** (`exports.d.ts`): Combined type definitions and utility types

## PII Fields

The following fields are marked as personally identifiable information (PII) in the type definitions:

- `visitor.email`
- `visitor.name`
- `visitor.phone`
- `visitor.first_name`
- `visitor.last_name`

When working with these fields, ensure you're complying with privacy regulations.