/**
 * Unit tests for project manifest processor utility
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import path from 'path';

// Mock the file system
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined)
}));

// Mock component detector
jest.mock('../../../src/utils/component-detector', () => ({
  isGliaFunction: jest.fn().mockResolvedValue(true),
  isGliaApplet: jest.fn().mockResolvedValue(true),
  detectKvNamespaces: jest.fn().mockResolvedValue(['test_namespace']),
  findJavaScriptFiles: jest.fn().mockResolvedValue(['function.js']),
  findHtmlFiles: jest.fn().mockResolvedValue(['applet.html'])
}));

// Mock schema validator
jest.mock('../../../src/utils/schema-validator', () => ({
  validate: jest.fn().mockReturnValue({ valid: true, errors: [] })
}));

// Import after mocking
import fs from 'fs/promises';
import { processProjectManifest, autoDiscoverComponents } from '../../../src/utils/project-manifest-processor';
import { isGliaFunction, isGliaApplet, detectKvNamespaces, findJavaScriptFiles, findHtmlFiles } from '../../../src/utils/component-detector';
import { validate } from '../../../src/utils/schema-validator';

describe('Project Manifest Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processProjectManifest', () => {
    test('should use template projectManifest if available', async () => {
      // Arrange
      const template = {
        name: 'test-template',
        projectManifest: {
          name: '${projectName}',
          version: '1.0.0',
          components: {
            functions: [{ name: 'test-function', path: 'function.js' }]
          }
        }
      };
      
      const variables = {
        projectName: 'test-project'
      };
      
      const outputDir = '/test/output';
      
      // Act
      const result = await processProjectManifest(template, variables, outputDir);
      
      // Assert
      expect(result).toEqual({
        name: 'test-project',
        version: '1.0.0',
        components: {
          functions: [{ name: 'test-function', path: 'function.js' }]
        }
      });
      
      // Verify validation was called
      expect(validate).toHaveBeenCalled();
    });

    test('should create default manifest if template has no projectManifest', async () => {
      // Arrange
      const template = {
        name: 'test-template'
      };
      
      const variables = {
        projectName: 'test-project',
        description: 'Test description'
      };
      
      const outputDir = '/test/output';
      
      // Mock function discovery
      findJavaScriptFiles.mockResolvedValueOnce(['function.js']);
      findHtmlFiles.mockResolvedValueOnce(['applet.html']);
      
      // Act
      const result = await processProjectManifest(template, variables, outputDir, {
        autoDiscover: true
      });
      
      // Assert
      expect(result.name).toBe('test-project');
      expect(result.description).toBe('Test description');
      expect(result.components).toBeDefined();
      expect(result.components.functions).toBeInstanceOf(Array);
      expect(result.components.applets).toBeInstanceOf(Array);
      expect(result.kvStore).toBeDefined();
      expect(result.kvStore.namespaces).toBeInstanceOf(Array);
    });

    test('should handle validation errors', async () => {
      // Arrange
      const template = {
        name: 'test-template',
        projectManifest: {
          name: '${projectName}',
          components: {} // Missing required version
        }
      };
      
      const variables = {
        projectName: 'test-project'
      };
      
      const outputDir = '/test/output';
      
      // Mock validation error
      validate.mockReturnValueOnce({
        valid: false,
        errors: ['Missing required property: version']
      });
      
      // Act & Assert
      await expect(processProjectManifest(template, variables, outputDir))
        .rejects.toThrow('Invalid project manifest');
    });
  });

  describe('autoDiscoverComponents', () => {
    test('should discover functions, applets, and KV namespaces', async () => {
      // Arrange
      const manifest = {
        components: {
          functions: [],
          applets: []
        },
        kvStore: {
          namespaces: []
        },
        linkages: []
      };
      
      const outputDir = '/test/output';
      
      // Mock file discovery
      findJavaScriptFiles.mockResolvedValueOnce(['function.js']);
      findHtmlFiles.mockResolvedValueOnce(['applet.html']);
      isGliaFunction.mockResolvedValueOnce(true);
      isGliaApplet.mockResolvedValueOnce(true);
      detectKvNamespaces.mockResolvedValueOnce(['test_namespace']);
      
      // Act
      await autoDiscoverComponents(manifest, outputDir);
      
      // Assert
      expect(manifest.components.functions).toHaveLength(1);
      expect(manifest.components.functions[0].name).toBe('function');
      expect(manifest.components.functions[0].path).toBe('function.js');
      
      expect(manifest.components.applets).toHaveLength(1);
      expect(manifest.components.applets[0].name).toBe('applet');
      expect(manifest.components.applets[0].path).toBe('applet.html');
      
      expect(manifest.components.functions[0].kvStore).toBeDefined();
      expect(manifest.components.functions[0].kvStore.namespaces).toContain('test_namespace');
      
      expect(manifest.kvStore.namespaces).toHaveLength(1);
      expect(manifest.kvStore.namespaces[0].name).toBe('test_namespace');
    });

    test('should respect max files limit', async () => {
      // Arrange
      const manifest = {
        components: {
          functions: [],
          applets: []
        },
        kvStore: {
          namespaces: []
        },
        linkages: []
      };
      
      const outputDir = '/test/output';
      
      // Mock many files
      const manyFiles = Array(10).fill(0).map((_, i) => `function${i}.js`);
      findJavaScriptFiles.mockResolvedValueOnce(manyFiles);
      
      // Act
      await autoDiscoverComponents(manifest, outputDir, { maxFiles: 5 });
      
      // Assert
      expect(isGliaFunction).toHaveBeenCalledTimes(5); // Should stop at max
    });
  });
});