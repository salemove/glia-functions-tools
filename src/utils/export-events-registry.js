/**
 * Export Events Registry
 * 
 * Central registry for all Glia export event types, including metadata and schemas.
 * This provides a unified way to discover and work with export events.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { BASE_TEMPLATE_PATHS } from './template-registry.js';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to schema files
const SCHEMAS_DIR = path.resolve(__dirname, '../templates/projects/export-handler-base/schemas');

// Path to export templates
const EXPORT_TEMPLATES_DIR = path.resolve(BASE_TEMPLATE_PATHS.project);

/**
 * Registry of export event types with metadata
 */
export const EXPORT_EVENT_TYPES = {
  'engagement-start': {
    displayName: 'Engagement Start',
    description: 'Triggered when a new engagement begins',
    schemaFile: 'engagement-start-schema.json',
    samplePayloadFile: 'engagement-start-sample.json',
    templateName: 'export-handler-engagement-start',
    tags: ['export', 'webhook', 'engagement'],
    documentation: 'https://docs.glia.com/reference/export-events#engagement-start'
  },
  'engagement-end': {
    displayName: 'Engagement End',
    description: 'Triggered when an engagement ends',
    schemaFile: 'engagement-end-schema.json',
    samplePayloadFile: 'engagement-end-sample.json',
    templateName: 'export-handler-engagement-end',
    tags: ['export', 'webhook', 'engagement'],
    documentation: 'https://docs.glia.com/reference/export-events#engagement-end'
  },
  'engagement-transfer': {
    displayName: 'Engagement Transfer',
    description: 'Triggered when an engagement is transferred to another queue or operator',
    schemaFile: 'engagement-transfer-schema.json',
    samplePayloadFile: 'engagement-transfer-sample.json',
    templateName: 'export-handler-engagement-transfer',
    tags: ['export', 'webhook', 'engagement', 'transfer'],
    documentation: 'https://docs.glia.com/reference/export-events#engagement-transfer'
  },
  'presence-update': {
    displayName: 'Presence Update',
    description: 'Triggered when an operator presence status changes',
    schemaFile: 'presence-update-schema.json',
    samplePayloadFile: 'presence-update-sample.json',
    templateName: 'export-handler-presence-update',
    tags: ['export', 'webhook', 'operator', 'presence'],
    documentation: 'https://docs.glia.com/reference/export-events#presence-update'
  }
};

/**
 * Get all available export event types
 * 
 * @param {boolean} refresh - Whether to refresh template information
 * @returns {Object} Object with event type keys and metadata
 */
export async function getExportEventTypes(refresh = false) {
  try {
    // If refresh is requested, check for template existence
    if (refresh) {
      const { readTemplateRegistry } = await import('./template-registry.js');
      const registry = await readTemplateRegistry(true);
      
      // Update template information from registry
      Object.entries(EXPORT_EVENT_TYPES).forEach(([eventType, metadata]) => {
        const templateName = metadata.templateName;
        if (templateName && registry.byName[templateName]) {
          metadata.templateExists = true;
          metadata.template = registry.byName[templateName];
        } else {
          metadata.templateExists = false;
        }
      });
    }
  } catch (error) {
    console.warn('Error refreshing export event types:', error);
  }
  
  return EXPORT_EVENT_TYPES;
}

/**
 * Get metadata for a specific export event type
 * 
 * @param {string} eventType - The export event type
 * @param {boolean} refresh - Whether to refresh template information
 * @returns {Object|null} Event metadata or null if not found
 */
export async function getExportEventMetadata(eventType, refresh = false) {
  // If refresh is requested or we're getting a specific event type
  // refresh the template data to ensure we have the latest info
  await getExportEventTypes(refresh);
  return EXPORT_EVENT_TYPES[eventType] || null;
}

/**
 * Get metadata for a specific export event type (synchronous version)
 * 
 * @param {string} eventType - The export event type
 * @returns {Object|null} Event metadata or null if not found
 */
export function getExportEventMetadataSync(eventType) {
  return EXPORT_EVENT_TYPES[eventType] || null;
}

/**
 * Get path to the schema file for a specific event type
 * 
 * @param {string} eventType - The export event type
 * @returns {string|null} Path to the schema file or null if not found
 */
export async function getSchemaPath(eventType) {
  const metadata = await getExportEventMetadata(eventType);
  if (!metadata || !metadata.schemaFile) {
    return null;
  }
  
  return path.join(SCHEMAS_DIR, metadata.schemaFile);
}

/**
 * Get path to the schema file for a specific event type (synchronous version)
 * 
 * @param {string} eventType - The export event type
 * @returns {string|null} Path to the schema file or null if not found
 */
export function getSchemaPathSync(eventType) {
  const metadata = getExportEventMetadataSync(eventType);
  if (!metadata || !metadata.schemaFile) {
    return null;
  }
  
  return path.join(SCHEMAS_DIR, metadata.schemaFile);
}

/**
 * Get path to the sample payload file for a specific event type
 * 
 * @param {string} eventType - The export event type
 * @returns {string|null} Path to the sample payload file or null if not found
 */
export async function getSamplePayloadPath(eventType) {
  const metadata = await getExportEventMetadata(eventType);
  if (!metadata || !metadata.samplePayloadFile) {
    return null;
  }
  
  return path.join(SCHEMAS_DIR, metadata.samplePayloadFile);
}

/**
 * Get path to the sample payload file for a specific event type (synchronous version)
 * 
 * @param {string} eventType - The export event type
 * @returns {string|null} Path to the sample payload file or null if not found
 */
export function getSamplePayloadPathSync(eventType) {
  const metadata = getExportEventMetadataSync(eventType);
  if (!metadata || !metadata.samplePayloadFile) {
    return null;
  }
  
  return path.join(SCHEMAS_DIR, metadata.samplePayloadFile);
}

/**
 * Filter export event types by tag
 * 
 * @param {string} tag - Tag to filter by
 * @param {boolean} refresh - Whether to refresh template information
 * @returns {Promise<Object>} Filtered export event types
 */
export async function filterEventTypesByTag(tag, refresh = false) {
  // Ensure we have the latest template data
  await getExportEventTypes(refresh);
  
  if (!tag) {
    return EXPORT_EVENT_TYPES;
  }
  
  return Object.entries(EXPORT_EVENT_TYPES)
    .filter(([_, metadata]) => metadata.tags && metadata.tags.includes(tag))
    .reduce((acc, [key, metadata]) => {
      acc[key] = metadata;
      return acc;
    }, {});
}

/**
 * Filter export event types by tag (synchronous version)
 * 
 * @param {string} tag - Tag to filter by
 * @returns {Object} Filtered export event types
 */
export function filterEventTypesByTagSync(tag) {
  if (!tag) {
    return EXPORT_EVENT_TYPES;
  }
  
  return Object.entries(EXPORT_EVENT_TYPES)
    .filter(([_, metadata]) => metadata.tags && metadata.tags.includes(tag))
    .reduce((acc, [key, metadata]) => {
      acc[key] = metadata;
      return acc;
    }, {});
}

export default {
  EXPORT_EVENT_TYPES,
  getExportEventTypes,
  getExportEventMetadata,
  getExportEventMetadataSync,
  getSchemaPath,
  getSchemaPathSync,
  getSamplePayloadPath,
  getSamplePayloadPathSync,
  filterEventTypesByTag,
  filterEventTypesByTagSync
};