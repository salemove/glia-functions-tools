/**
 * Project manifest schema
 * 
 * This schema defines the structure for project manifest files (glia-project.json)
 */

export const projectManifestSchema = {
  type: 'object',
  required: ['name', 'version', 'components'],
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    description: { type: 'string' },
    author: { type: 'string' },
    environment: { type: 'string' },
    components: {
      type: 'object',
      properties: {
        functions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'path'],
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              path: { type: 'string' },
              environment: {
                type: 'object',
                additionalProperties: { type: 'string' }
              },
              kvStore: {
                type: 'object',
                properties: {
                  namespaces: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                }
              },
              timeout: { type: 'number' }
            }
          }
        },
        applets: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'path'],
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              path: { type: 'string' },
              scope: {
                type: 'string',
                enum: ['engagement', 'global']
              }
            }
          }
        }
      }
    },
    kvStore: {
      type: 'object',
      properties: {
        namespaces: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              ttl: { type: 'number' }
            }
          }
        }
      }
    },
    linkages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['from', 'to', 'placeholders'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          placeholders: {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        }
      }
    },
    deployment: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['atomic', 'progressive']
        },
        rollback: { type: 'boolean' },
        validateBefore: { type: 'boolean' }
      }
    }
  }
};

export default projectManifestSchema;