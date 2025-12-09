import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { getTemplateDefaultVars } from '../../../src/utils/unified-template-manager.js';

describe('unifiedTemplateManager', () => {
  const mockFunctionTemplate = {
    name: 'basic-function',
    type: 'function',
    displayName: 'Basic Function',
    description: 'A basic function template',
    path: '/mock/templates/functions/basic-function',
    version: '1.0.0',
    files: ['function.js', 'package.json', 'README.md'],
    variables: {
      functionName: {
        required: true,
        default: 'MyFunction',
        description: 'Name of the function'
      },
      description: {
        required: false,
        default: 'A basic function',
        description: 'Function description'
      }
    }
  };
  
  describe('getTemplateDefaultVars', () => {
    it('should extract default variables from template', () => {
      const result = getTemplateDefaultVars(mockFunctionTemplate);
      
      expect(result).toEqual({
        functionName: 'MyFunction',
        description: 'A basic function'
      });
    });
    
    it('should handle templates with no variables', () => {
      const result = getTemplateDefaultVars({});
      
      expect(result).toEqual({});
    });
  });
});