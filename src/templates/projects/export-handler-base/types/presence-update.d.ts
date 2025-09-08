/**
 * TypeScript definitions for Glia presence update export events
 * @version v1
 */

/// <reference path="./index.d.ts" />

declare namespace GliaExports {
  /**
   * Media types available in interactions
   */
  type MediaType = 'chat' | 'messaging' | 'audio' | 'video';

  /**
   * User status value types
   */
  type UserStatusValue = 
    | 'available'
    | 'offline'
    | 'quick-break'
    | 'post-engagement-break'
    | string;

  /**
   * User availability status
   */
  type UserAvailability = 'available' | 'unavailable' | 'offline';
  
  /**
   * Activity level types
   */
  type ActivityLevel = 'idle' | 'interacting_at_capacity' | null;
  
  /**
   * Interaction status types
   */
  type InteractionStatus = 'alerting' | 'connected' | 'after_call_work' | string;
  
  /**
   * Interaction role types
   */
  type InteractionRole = 'host' | 'participant' | string;
  
  /**
   * Request direction types
   */
  type RequestDirection = 'proactive' | 'reactive';
  
  /**
   * User status information
   */
  interface UserStatus {
    /** Current status value */
    value: UserStatusValue;
    /** ISO timestamp when the status was last changed */
    changed_at: string;
  }
  
  /**
   * User capacity settings
   */
  interface UserCapacity {
    /** Whether the user becomes unavailable after interactions */
    unavailable_after_interactions: boolean;
    /** Media types available before any interactions */
    media_before_interactions: MediaType[];
    /** Currently available media types */
    media: MediaType[];
    /** Reason for the capacity change */
    change_reason: string | null;
  }
  
  /**
   * User interaction information
   */
  interface UserInteraction {
    /** ISO timestamp when the interaction status last changed */
    status_changed_at: string;
    /** Interaction status */
    status: InteractionStatus;
    /** User role in the interaction */
    role: InteractionRole;
    /** Media types used in this interaction */
    media: MediaType[];
    /** Direction of the initial request */
    initial_request_direction: RequestDirection;
    /** Unique identifier for the interaction */
    id: string;
  }
  
  /**
   * User activity information
   */
  interface UserActivity {
    /** Whether user is only in after call work state */
    only_after_call_work: boolean;
    /** Activity level */
    level: ActivityLevel;
    /** Current user interactions */
    interactions: UserInteraction[];
  }
  
  /**
   * User presence event
   */
  interface UserPresenceEvent {
    /** ISO timestamp indicating when this presence state became valid */
    valid_from: string;
    /** Unique identifier for the user */
    user_id: string;
    /** Email address of the user */
    user_email: string;
    /** User status information */
    status: UserStatus;
    /** User capacity and media settings */
    capacity: UserCapacity;
    /** Overall availability status */
    availability: UserAvailability;
    /** User activity information */
    activity: UserActivity;
    /** Account identifier */
    account_id: string;
  }
  
  /**
   * Presence update event payload
   */
  interface PresenceUpdateEvent {
    /** ISO timestamp when the presence update was sent */
    sent_at: string;
    /** List of presence update events */
    events: UserPresenceEvent[];
    /** Type of action - always 'user_presence_update' for this event type */
    action: 'user_presence_update';
  }
  
  /**
   * Type guard to check if an event is a PresenceUpdateEvent
   * @param event Any export event
   * @returns Whether the event is a PresenceUpdateEvent
   */
  function isPresenceUpdateEvent(event: any): event is PresenceUpdateEvent {
    return event && 
           event.action === 'user_presence_update' &&
           Array.isArray(event.events) &&
           typeof event.sent_at === 'string';
  }
}

export = GliaExports.PresenceUpdateEvent;
export as namespace GliaExports.PresenceUpdateEvent;