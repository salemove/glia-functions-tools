/**
 * TypeScript definitions for Glia export event payloads
 * @version v1
 */

/**
 * Common types shared across different export events
 */
declare namespace GliaExports {
  /**
   * Base export event with common fields across all export types
   */
  interface BaseExportEvent {
    /** Schema version */
    version: string;
    /** Type of export event */
    export_type: string;
    /** Unique identifier for the site */
    site_id: string;
    /** Custom fields defined for this event */
    custom_fields?: CustomField[];
  }

  /**
   * Custom field entry with key-value pair
   */
  interface CustomField {
    /** Key of the custom field */
    key: string;
    /** Value of the custom field */
    value: string | number | boolean | null;
  }

  /**
   * Information about a queue
   */
  interface Queue {
    /** Unique identifier for the queue */
    id: string;
    /** Name of the queue */
    name?: string;
  }

  /**
   * Information about a visitor (includes PII)
   */
  interface Visitor {
    /** Unique identifier for the visitor */
    id: string;
    /** Email of the visitor (PII) */
    email?: string;
    /** Full name of the visitor (PII) */
    name?: string;
    /** Phone number of the visitor (PII) */
    phone?: string;
  }

  /**
   * Information about an operator
   */
  interface Operator {
    /** Unique identifier for the operator */
    id: string;
    /** Name of the operator */
    name?: string;
    /** Email of the operator */
    email?: string;
  }

  /**
   * Operator group information
   */
  interface Group {
    /** Unique identifier for the group */
    id: string;
    /** Name of the group */
    name?: string;
  }

  /**
   * Operator communication capabilities
   */
  interface Capabilities {
    /** Whether the operator can handle chat engagements */
    chat?: boolean;
    /** Whether the operator can handle audio engagements */
    audio?: boolean;
    /** Whether the operator can handle video engagements */
    video?: boolean;
    /** Whether the operator can handle cobrowse engagements */
    cobrowse?: boolean;
  }

  /**
   * Operator availability metrics
   */
  interface Availability {
    /** Maximum number of concurrent engagements the operator can handle */
    max_concurrent_engagements?: number;
    /** Current number of active engagements the operator is handling */
    current_engagement_count?: number;
  }

  /**
   * Engagement metrics
   */
  interface Metrics {
    /** Time in seconds the visitor waited before being connected to an operator */
    wait_time?: number;
    /** Total number of messages exchanged */
    message_count?: number;
    /** Number of messages sent by the visitor */
    visitor_message_count?: number;
    /** Number of messages sent by the operator */
    operator_message_count?: number;
    /** Customer satisfaction score (if provided) */
    csat_score?: number;
    /** Whether a post-engagement survey was submitted */
    survey_submitted?: boolean;
  }

  /**
   * Transfer source or destination information
   */
  interface TransferEndpoint {
    /** Type of transfer endpoint */
    type: 'queue' | 'operator';
    /** ID of the queue (if type is queue) */
    queue_id?: string;
    /** Name of the queue (if type is queue) */
    queue_name?: string;
    /** ID of the operator (if type is operator) */
    operator_id?: string;
    /** Name of the operator (if type is operator) */
    operator_name?: string;
    /** ID of the operator's group (if type is operator) */
    group_id?: string;
    /** Name of the operator's group (if type is operator) */
    group_name?: string;
  }

  /**
   * Sources of engagements
   */
  type EngagementSource = 'button_embed' | 'chat_embed' | 'api' | 'voice_callback' | string;

  /**
   * Types of engagement supported by Glia
   */
  type EngagementType = 'chat' | 'audio' | 'video' | 'cobrowse';

  /**
   * Reasons why an engagement might end
   */
  type EndReason = 'visitor_closed' | 'operator_closed' | 'timeout' | 'system';

  /**
   * Operator presence statuses
   */
  type PresenceStatus = 'online' | 'offline' | 'away' | 'busy' | 'dnd' | 'invisible';
  
  /**
   * Platform variants in Glia
   */
  type Platform = 'omnicore' | string;
}

export = GliaExports;
export as namespace GliaExports;