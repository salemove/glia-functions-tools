/**
 * TypeScript definitions for Glia engagement end export events
 * @version v1
 */

/// <reference path="./index.d.ts" />

declare namespace GliaExports {
  /**
   * Message in a chat transcript
   */
  interface ChatMessage {
    /** Message content */
    content: string;
    /** Attachment information if the message includes files */
    attachment: ChatAttachment | null;
    /** ISO timestamp when the message was created */
    created_at: string;
    /** Information about the sender */
    sender: {
      /** Name of the sender */
      name: string;
      /** Type of sender */
      type: 'visitor' | 'operator' | 'system';
    };
  }

  /**
   * Attachment in a chat message
   */
  interface ChatAttachment {
    /** Type of attachment */
    type: string;
    /** List of attached files */
    files: Array<{
      /** File name */
      name: string;
      /** MIME type of the file */
      content_type: string;
      /** URL to download the file */
      url: string;
      /** Whether the file has been deleted */
      deleted?: boolean;
    }>;
  }

  /**
   * Engagement information
   */
  interface EngagementInfo {
    /** Unique identifier for the engagement */
    id: string;
    /** Whether the engagement was flagged */
    flagged: boolean;
    /** Duration of the engagement in seconds */
    duration: number;
    /** ISO timestamp when the engagement ended */
    ended_at: string;
    /** ISO timestamp when the engagement started */
    started_at: string;
    /** Type of the engagement (reactive or proactive) */
    type: string;
  }

  /**
   * Site information
   */
  interface SiteInfo {
    /** Unique identifier for the site */
    id: string;
    /** Name of the site */
    name?: string;
    /** Alternative names for the site */
    names?: Array<{
      /** Alternative site name */
      name: string;
    }>;
  }

  /**
   * Enhanced visitor information
   */
  interface EnhancedVisitor extends Visitor {
    /** Last name of the visitor (PII) */
    last_name?: string;
    /** Whether the visitor shared their screen */
    shared_screen: boolean;
    /** Type of device the visitor was using */
    device_type?: string;
    /** Visitor's browser */
    browser?: string;
  }

  /**
   * Engagement end event payload
   */
  interface EngagementEndEvent extends BaseExportEvent {
    /** Type of export event - always 'engagement' for this event type */
    export_type: 'engagement';
    /** Whether audio was used during the engagement */
    audio_used: boolean;
    /** Plain text version of the chat transcript */
    chat_transcript_plain_text?: string;
    /** Structured chat transcript with messages */
    chat_transcript?: ChatMessage[];
    /** Whether cobrowsing was used during the engagement */
    cobrowsing_used: boolean;
    /** Whether the engagement was forwarded to a CRM system */
    crm_forwarded?: boolean;
    /** Core engagement information */
    engagement: EngagementInfo;
    /** Who initiated the engagement */
    initiator: 'visitor' | 'operator';
    /** Engagement notes */
    notes?: string;
    /** Whether the operator shared their screen during the engagement */
    operator_shared_screen?: boolean;
    /** Operators who participated in the engagement */
    operators: Array<Operator>;
    /** The Glia platform variant handling this engagement */
    platform: Platform;
    /** Time in seconds the visitor waited in queue */
    queue_wait_time: number;
    /** Queues the engagement was routed through */
    queues: Queue[];
    /** Site information */
    site: SiteInfo;
    /** Source of the engagement */
    source: EngagementSource;
    /** Whether the engagement summary was forwarded */
    summary_forwarded?: boolean;
    /** Whether video was used during the engagement */
    video_used: boolean;
    /** Type of device the visitor was using */
    visitor_device_type?: string;
    /** Information about the visitor */
    visitor: EnhancedVisitor;
  }

  /**
   * Type guard to check if an event is an EngagementEndEvent
   * @param event Any export event
   * @returns Whether the event is an EngagementEndEvent
   */
  function isEngagementEndEvent(event: any): event is EngagementEndEvent {
    return event && 
           event.export_type === 'engagement' &&
           typeof event.engagement === 'object' &&
           typeof event.engagement.id === 'string' &&
           typeof event.visitor === 'object';
  }
}

export = GliaExports.EngagementEndEvent;
export as namespace GliaExports.EngagementEndEvent;