/**
 * TypeScript definitions for Glia engagement transfer export events
 * @version v1
 */

/// <reference path="./index.d.ts" />

declare namespace GliaExports {
  /**
   * Engagement transfer event payload
   */
  interface EngagementTransferEvent extends BaseExportEvent {
    /** Type of export event - always 'engagement_transfer' for this event type */
    export_type: 'engagement_transfer';
    /** Unique identifier for the engagement */
    engagement_id: string;
    /** Information about the operator handling the engagement */
    operator: Operator;
    /** Source of the engagement */
    source: EngagementSource;
    /** Information about the visitor */
    visitor: Visitor;
  }
  
  /**
   * Type guard to check if an event is an EngagementTransferEvent
   * @param event Any export event
   * @returns Whether the event is an EngagementTransferEvent
   */
  function isEngagementTransferEvent(event: any): event is EngagementTransferEvent {
    return event && 
           event.export_type === 'engagement_transfer' &&
           typeof event.engagement_id === 'string' &&
           typeof event.operator === 'object' &&
           typeof event.visitor === 'object';
  }
}

export = GliaExports.EngagementTransferEvent;
export as namespace GliaExports.EngagementTransferEvent;