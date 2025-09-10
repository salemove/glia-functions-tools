/**
 * TypeScript definitions for Glia engagement start export events
 * @version v1
 */

/// <reference path="./index.d.ts" />

declare namespace GliaExports {
  /**
   * Engagement start event payload
   */
  interface EngagementStartEvent extends BaseExportEvent {
    /** Type of export event - always 'engagement_start' for this event type */
    export_type: 'engagement_start';
    /** Unique identifier for the engagement */
    engagement_id: string;
    /** Information about the operator handling the engagement */
    operator: Operator;
    /** The Glia platform variant handling this engagement */
    platform: Platform;
    /** Time in seconds the visitor waited in queue */
    queue_wait_time: number;
    /** Queues the engagement was routed through */
    queues: Queue[];
    /** Source of the engagement */
    source: EngagementSource;
    /** Information about the visitor */
    visitor: Visitor;
  }

  /**
   * Type guard to check if an event is an EngagementStartEvent
   * @param event Any export event
   * @returns Whether the event is an EngagementStartEvent
   */
  function isEngagementStartEvent(event: any): event is EngagementStartEvent {
    return event && 
           event.export_type === 'engagement_start' &&
           typeof event.engagement_id === 'string' &&
           typeof event.operator === 'object' &&
           typeof event.visitor === 'object';
  }
}

export = GliaExports.EngagementStartEvent;
export as namespace GliaExports.EngagementStartEvent;