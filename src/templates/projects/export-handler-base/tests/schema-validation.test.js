/**
 * Tests for schema validation
 */
import { validatePayload, getSchema, getSamplePayload } from '../lib/validation.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to schema directory
const SCHEMAS_DIR = path.resolve(__dirname, '../schemas');

describe('Schema Validation Tests', () => {
  
  describe('Base Schema', () => {
    it('should have a valid base schema', () => {
      const baseSchemaPath = path.join(SCHEMAS_DIR, 'base-schema.json');
      expect(fs.existsSync(baseSchemaPath)).toBe(true);
      
      const baseSchema = JSON.parse(fs.readFileSync(baseSchemaPath, 'utf8'));
      expect(baseSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(baseSchema.type).toBe('object');
      expect(baseSchema.required).toContain('version');
      expect(baseSchema.required).toContain('export_type');
      expect(baseSchema.required).toContain('site_id');
    });
  });
  
  describe('Engagement Start Schema', () => {
    it('should validate a valid engagement start payload', () => {
      const sample = getSamplePayload('engagement_start');
      const result = validatePayload(sample, 'engagement_start');
      expect(result.valid).toBe(true);
    });
    
    it('should reject an invalid engagement start payload', () => {
      const sample = getSamplePayload('engagement_start');
      delete sample.engagement_id;
      const result = validatePayload(sample, 'engagement_start');
      expect(result.valid).toBe(false);
    });
  });
  
  describe('Engagement End Schema', () => {
    it('should validate a valid engagement end payload', () => {
      const sample = getSamplePayload('engagement_end');
      const result = validatePayload(sample, 'engagement');
      expect(result.valid).toBe(true);
    });
    
    it('should reject an invalid engagement end payload', () => {
      const sample = getSamplePayload('engagement_end');
      delete sample.engagement;
      const result = validatePayload(sample, 'engagement');
      expect(result.valid).toBe(false);
    });
  });
  
  describe('Engagement Transfer Schema', () => {
    it('should validate a valid engagement transfer payload', () => {
      const sample = getSamplePayload('engagement_transfer');
      const result = validatePayload(sample, 'engagement_transfer');
      expect(result.valid).toBe(true);
    });
    
    it('should reject an invalid engagement transfer payload', () => {
      const sample = getSamplePayload('engagement_transfer');
      delete sample.operator;
      const result = validatePayload(sample, 'engagement_transfer');
      expect(result.valid).toBe(false);
    });
  });
  
  describe('Presence Update Schema', () => {
    it('should validate a valid presence update payload', () => {
      const sample = getSamplePayload('presence_update');
      const result = validatePayload(sample, 'presence_update');
      expect(result.valid).toBe(true);
    });
    
    it('should reject an invalid presence update payload', () => {
      const sample = getSamplePayload('presence_update');
      delete sample.events;
      const result = validatePayload(sample, 'presence_update');
      expect(result.valid).toBe(false);
    });
  });
  
  describe('Event Type Detection', () => {
    it('should auto-detect engagement start events', () => {
      const sample = getSamplePayload('engagement_start');
      const result = validatePayload(sample);
      expect(result.valid).toBe(true);
    });
    
    it('should auto-detect engagement end events', () => {
      const sample = getSamplePayload('engagement_end');
      const result = validatePayload(sample);
      expect(result.valid).toBe(true);
    });
    
    it('should auto-detect engagement transfer events', () => {
      const sample = getSamplePayload('engagement_transfer');
      const result = validatePayload(sample);
      expect(result.valid).toBe(true);
    });
    
    it('should auto-detect presence update events', () => {
      const sample = getSamplePayload('presence_update');
      const result = validatePayload(sample);
      expect(result.valid).toBe(true);
    });
  });
});