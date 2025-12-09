/**
 * Unit tests for project manifest support in the template registry
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Mock template registry functions that aren't being tested
jest.mock('../../../src/utils/template-registry', () => {
  const originalModule = jest.requireActual('../../../src/utils/template-registry');
  
  return {
    ...originalModule,
    readTemplateRegistry: jest.fn(),
    getTemplateByName: jest.fn()
  };
});

// Import after mocking
import { mergeProjectManifest } from '../../../src/utils/template-registry';

describe('Template Registry Project Manifest Support', () => {
  describe('mergeProjectManifest', () => {
    test('should return childManifest if parentManifest is missing', () => {
      // Arrange
      const childManifest = {
        name: 'child-project',
        version: '1.0.0',
        components: {
          functions: [{ name: 'func1', path: 'func1.js' }]
        }
      };
      
      // Act
      const result = mergeProjectManifest(null, childManifest);
      
      // Assert
      expect(result).toBe(childManifest);
    });
    
    test('should return parentManifest if childManifest is missing', () => {
      // Arrange
      const parentManifest = {
        name: 'parent-project',
        version: '1.0.0',
        components: {
          functions: [{ name: 'func1', path: 'func1.js' }]
        }
      };
      
      // Act
      const result = mergeProjectManifest(parentManifest, null);
      
      // Assert
      expect(result).toBe(parentManifest);
    });
    
    test('should merge basic properties correctly', () => {
      // Arrange
      const parentManifest = {
        name: 'parent-project',
        version: '1.0.0',
        description: 'Parent description'
      };
      
      const childManifest = {
        name: 'child-project',
        description: undefined,
        author: 'Test Author'
      };
      
      // Act
      const result = mergeProjectManifest(parentManifest, childManifest);
      
      // Assert
      expect(result.name).toBe('child-project');
      expect(result.version).toBe('1.0.0'); // Inherited from parent
      expect(result.description).toBe('Parent description'); // Inherited from parent
      expect(result.author).toBe('Test Author'); // From child
    });
    
    test('should merge functions by name', () => {
      // Arrange
      const parentManifest = {
        components: {
          functions: [
            { name: 'func1', path: 'func1.js', description: 'Parent function' },
            { name: 'func2', path: 'func2.js' }
          ]
        }
      };
      
      const childManifest = {
        components: {
          functions: [
            { name: 'func1', path: 'custom-path.js' }, // Override path
            { name: 'func3', path: 'func3.js' } // New function
          ]
        }
      };
      
      // Act
      const result = mergeProjectManifest(parentManifest, childManifest);
      
      // Assert
      expect(result.components.functions).toHaveLength(3);
      
      const func1 = result.components.functions.find(f => f.name === 'func1');
      expect(func1.path).toBe('custom-path.js'); // Child overrides path
      expect(func1.description).toBe('Parent function'); // Keeps parent description
      
      const func2 = result.components.functions.find(f => f.name === 'func2');
      expect(func2).toBeDefined(); // Kept from parent
      
      const func3 = result.components.functions.find(f => f.name === 'func3');
      expect(func3).toBeDefined(); // Added from child
    });
    
    test('should merge KV namespaces correctly', () => {
      // Arrange
      const parentManifest = {
        kvStore: {
          namespaces: [
            { name: 'ns1', ttl: 3600 },
            { name: 'ns2', ttl: 86400 }
          ]
        }
      };
      
      const childManifest = {
        kvStore: {
          namespaces: [
            { name: 'ns1', ttl: 7200 }, // Override TTL
            { name: 'ns3', description: 'New namespace' } // New namespace
          ]
        }
      };
      
      // Act
      const result = mergeProjectManifest(parentManifest, childManifest);
      
      // Assert
      expect(result.kvStore.namespaces).toHaveLength(3);
      
      const ns1 = result.kvStore.namespaces.find(ns => ns.name === 'ns1');
      expect(ns1.ttl).toBe(7200); // Override from child
      
      const ns2 = result.kvStore.namespaces.find(ns => ns.name === 'ns2');
      expect(ns2).toBeDefined(); // Kept from parent
      
      const ns3 = result.kvStore.namespaces.find(ns => ns.name === 'ns3');
      expect(ns3.description).toBe('New namespace'); // Added from child
    });
    
    test('should merge linkages correctly', () => {
      // Arrange
      const parentManifest = {
        linkages: [
          {
            from: 'functions.func1',
            to: 'applets.app1',
            placeholders: { URI: 'invocation_uri' }
          }
        ]
      };
      
      const childManifest = {
        linkages: [
          {
            from: 'functions.func2',
            to: 'applets.app2',
            placeholders: { URI: 'invocation_uri' }
          }
        ]
      };
      
      // Act
      const result = mergeProjectManifest(parentManifest, childManifest);
      
      // Assert
      expect(result.linkages).toHaveLength(2);
      
      const linkage1 = result.linkages.find(l => l.from === 'functions.func1');
      expect(linkage1).toBeDefined();
      
      const linkage2 = result.linkages.find(l => l.from === 'functions.func2');
      expect(linkage2).toBeDefined();
    });
    
    test('should not add duplicate linkages', () => {
      // Arrange
      const parentManifest = {
        linkages: [
          {
            from: 'functions.func1',
            to: 'applets.app1',
            placeholders: { URI: 'invocation_uri' }
          }
        ]
      };
      
      const childManifest = {
        linkages: [
          {
            from: 'functions.func1',
            to: 'applets.app1', // Same from/to as parent
            placeholders: { URI2: 'id' } // Different placeholders
          }
        ]
      };
      
      // Act
      const result = mergeProjectManifest(parentManifest, childManifest);
      
      // Assert
      expect(result.linkages).toHaveLength(1); // No duplicate
    });
  });
});