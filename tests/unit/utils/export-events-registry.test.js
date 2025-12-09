/**
 * Unit tests for export-events-registry
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import fs from 'fs';

// Mock the path resolution
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn((_, p) => p)
}));

// Import the module after mocking
import { 
  EXPORT_EVENT_TYPES,
  getExportEventTypes,
  getExportEventMetadata,
  getSchemaPath,
  getSamplePayloadPath,
  filterEventTypesByTag
} from '../../../src/utils/export-events-registry';

describe('Export Events Registry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export all required functions', () => {
    expect(getExportEventTypes).toBeDefined();
    expect(getExportEventMetadata).toBeDefined();
    expect(getSchemaPath).toBeDefined();
    expect(getSamplePayloadPath).toBeDefined();
    expect(filterEventTypesByTag).toBeDefined();
  });

  it('should define all required export event types', () => {
    // Test that all required event types are defined
    const expectedEventTypes = [
      'engagement-start',
      'engagement-end',
      'engagement-transfer',
      'presence-update'
    ];
    
    const availableEventTypes = Object.keys(EXPORT_EVENT_TYPES);
    
    expectedEventTypes.forEach(eventType => {
      expect(availableEventTypes).toContain(eventType);
    });
  });

  it('should get export event metadata for a valid event type', () => {
    const metadata = getExportEventMetadata('engagement-start');
    
    expect(metadata).toBeDefined();
    expect(metadata.displayName).toBe('Engagement Start');
    expect(metadata.description).toContain('engagement begins');
    expect(metadata.templateName).toBe('export-handler-engagement-start');
    expect(metadata.tags).toContain('export');
    expect(metadata.tags).toContain('webhook');
  });

  it('should return null for an invalid event type', () => {
    const metadata = getExportEventMetadata('invalid-event-type');
    expect(metadata).toBeNull();
  });

  it('should return all event types', () => {
    const eventTypes = getExportEventTypes();
    
    expect(eventTypes).toBe(EXPORT_EVENT_TYPES);
    expect(Object.keys(eventTypes).length).toBeGreaterThanOrEqual(4);
  });

  it('should get schema path for an event type', () => {
    path.resolve.mockImplementation((dir, file) => `${dir}/${file}`);
    
    const schemaPath = getSchemaPath('engagement-start');
    
    expect(schemaPath).toContain('engagement-start-schema.json');
  });

  it('should get sample payload path for an event type', () => {
    path.resolve.mockImplementation((dir, file) => `${dir}/${file}`);
    
    const samplePath = getSamplePayloadPath('engagement-start');
    
    expect(samplePath).toContain('engagement-start-sample.json');
  });

  it('should filter event types by tag', () => {
    // Filter by 'engagement' tag
    const engagementEvents = filterEventTypesByTag('engagement');
    
    // Should include engagement events but not presence events
    expect(Object.keys(engagementEvents)).toContain('engagement-start');
    expect(Object.keys(engagementEvents)).toContain('engagement-end');
    expect(Object.keys(engagementEvents)).toContain('engagement-transfer');
    expect(Object.keys(engagementEvents)).not.toContain('presence-update');
    
    // Filter by 'presence' tag
    const presenceEvents = filterEventTypesByTag('presence');
    
    // Should include presence events but not engagement events
    expect(Object.keys(presenceEvents)).toContain('presence-update');
    expect(Object.keys(presenceEvents)).not.toContain('engagement-start');
  });

  it('should return all events when tag is empty', () => {
    const allEvents = filterEventTypesByTag('');
    
    expect(Object.keys(allEvents).length).toBe(Object.keys(EXPORT_EVENT_TYPES).length);
  });
});