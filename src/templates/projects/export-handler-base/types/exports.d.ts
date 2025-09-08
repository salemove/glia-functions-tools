/**
 * Combined TypeScript definitions for all Glia export event types
 * @version v1
 */

/// <reference path="./index.d.ts" />
/// <reference path="./engagement-start.d.ts" />
/// <reference path="./engagement-end.d.ts" />
/// <reference path="./engagement-transfer.d.ts" />
/// <reference path="./presence-update.d.ts" />

declare namespace GliaExports {
  /**
   * Union type of all export event payloads
   */
  type ExportEvent = 
    | EngagementStartEvent 
    | EngagementEndEvent 
    | EngagementTransferEvent 
    | PresenceUpdateEvent;
  
  /**
   * Map of export event types to their corresponding payload types
   */
  interface ExportEventTypeMap {
    'engagement_start': EngagementStartEvent;
    'engagement': EngagementEndEvent;
    'engagement_transfer': EngagementTransferEvent;
    'presence_update': PresenceUpdateEvent;
  }

  /**
   * Function validation result interface
   */
  interface ValidationResult {
    /** Whether the payload is valid */
    valid: boolean;
    /** Validation errors if the payload is invalid */
    errors?: ValidationError[];
  }

  /**
   * Validation error details
   */
  interface ValidationError {
    /** Path to the field with the error */
    path: string;
    /** Error message */
    message: string;
    /** Error type/code */
    errorType?: string;
    /** Keyword that triggered the error */
    keyword?: string;
    /** Schema reference that failed */
    schemaPath?: string;
  }

  /**
   * Parameters for forwarding an event to an external service
   */
  interface ForwardingOptions {
    /** URL to forward the event to */
    url: string;
    /** Authentication type */
    authType?: 'none' | 'api-key' | 'bearer' | 'basic';
    /** API key for authentication */
    apiKey?: string;
    /** Bearer token for authentication */
    bearerToken?: string;
    /** Username for basic authentication */
    username?: string;
    /** Password for basic authentication */
    password?: string;
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Base delay between retry attempts in milliseconds */
    retryDelay?: number;
    /** Request headers to include */
    headers?: Record<string, string>;
    /** HTTP method to use */
    method?: 'POST' | 'PUT' | 'PATCH';
    /** Whether to include the full event or just payload in request */
    sendFullEvent?: boolean;
  }

  /**
   * Options for filtering sensitive data
   */
  interface FilteringOptions {
    /** Fields to filter (in addition to default PII fields) */
    fields?: string[];
    /** Whether to remove the field completely or replace with placeholder */
    removeField?: boolean;
    /** Custom replacement value */
    replacementValue?: string;
    /** Fields to exclude from filtering */
    excludeFields?: string[];
  }

  /**
   * Function to validate a payload against a schema
   * @param payload - The payload to validate
   * @param eventType - The type of event to validate against
   * @param options - Validation options
   * @returns Validation result
   */
  function validatePayload<T extends keyof ExportEventTypeMap>(
    payload: unknown,
    eventType: T,
    options?: {
      /** Whether to allow additional properties not in schema */
      allowAdditionalProperties?: boolean;
      /** Whether to use cached validation (faster) */
      useCache?: boolean;
    }
  ): ValidationResult;

  /**
   * Function to filter sensitive data from a payload
   * @param data - The data to filter
   * @param options - Filtering options
   * @returns Filtered data
   */
  function filterSensitiveData<T>(
    data: T,
    options?: FilteringOptions
  ): T;

  /**
   * Function to forward an event to an external service
   * @param data - The data to forward
   * @param options - Forwarding options
   * @returns Response from the external service
   */
  function forwardToExternalService<T>(
    data: T,
    options: ForwardingOptions
  ): Promise<Response>;
  
  /**
   * Type guard to determine the type of export event
   * @param event - Any export event
   * @returns The event type or null if not recognized
   */
  function getExportEventType(event: unknown): keyof ExportEventTypeMap | null;
  
  /**
   * Get schema version information
   * @returns Schema version information
   */
  function getSchemaVersion(): {
    /** Current schema version */
    version: string;
    /** Whether schema versioning is supported */
    supportsVersioning: boolean;
    /** Supported schema versions */
    supportedVersions: string[];
  };
}

export = GliaExports;
export as namespace GliaExports;