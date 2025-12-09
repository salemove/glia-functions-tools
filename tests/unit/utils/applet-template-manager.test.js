import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock filesystem modules
jest.mock('fs');
jest.mock('path');

// Import the module under test
import * as appletTemplateManager from '../../../src/utils/applet-template-manager.js';

describe('appletTemplateManager', () => {
  // Setup mock data
  const mockTemplatesDir = '/mock/templates/applets';
  const mockTemplates = [
    {
      name: 'basic-html',
      displayName: 'Basic HTML Applet',
      description: 'Simple HTML applet with frontend and backend function',
      variables: {
        appletName: {
          description: 'Name of the applet',
          required: true,
          default: 'My Applet'
        }
      }
    },
    {
      name: 'react-app',
      displayName: 'React Applet',
      description: 'Modern React applet with Tailwind CSS',
      variables: {
        appletName: {
          description: 'Name of the applet',
          required: true,
          default: 'My React Applet'
        }
      }
    }
  ];
  
  // Mock file structure
  const mockFiles = {
    '/mock/templates/applets/basic-html/template.json': JSON.stringify(mockTemplates[0]),
    '/mock/templates/applets/basic-html/applet.html': '<html>{{appletName}}</html>',
    '/mock/templates/applets/basic-html/function.js': 'export async function onInvoke() {}',
    '/mock/templates/applets/react-app/template.json': JSON.stringify(mockTemplates[1]),
    '/mock/templates/applets/react-app/src/App.js': 'function App() { return <div>{{appletName}}</div>; }',
    '/mock/templates/applets/react-app/function.js': 'export async function onInvoke() {}'
  };
  
  // Setup before each test
  beforeEach(() => {
    // Reset mocks
    jest.resetAllMocks();
    
    // Setup path mock
    path.resolve.mockImplementation((dir, ...segments) => {
      return segments.reduce((acc, segment) => `${acc}/${segment}`, dir);
    });
    path.join.mockImplementation((...segments) => segments.join('/'));
    path.dirname.mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
    
    // Setup fs mock functions
    fs.existsSync.mockImplementation((filePath) => !!mockFiles[filePath] || filePath === mockTemplatesDir);
    fs.readFileSync.mockImplementation((filePath, encoding) => {
      if (mockFiles[filePath]) {
        return mockFiles[filePath];
      }
      throw new Error(`File not found: ${filePath}`);
    });
    fs.readdirAsync = jest.fn().mockResolvedValue(['basic-html', 'react-app']);
    fs.statAsync = jest.fn().mockImplementation((path) => {
      return Promise.resolve({
        isDirectory: () => path.endsWith('basic-html') || path.endsWith('react-app')
      });
    });
    fs.readFileAsync = jest.fn().mockImplementation((filePath, encoding) => {
      if (mockFiles[filePath]) {
        return Promise.resolve(mockFiles[filePath]);
      }
      return Promise.reject(new Error(`File not found: ${filePath}`));
    });
    fs.writeFileAsync = jest.fn().mockResolvedValue();
    fs.mkdirAsync = jest.fn().mockResolvedValue();
    
    // Setup mocked template directory path
    Object.defineProperty(appletTemplateManager, 'appletTemplatesDir', { 
      value: mockTemplatesDir,
      configurable: true
    });
  });
  
  describe('listAppletTemplates', () => {
    it('should return a list of available templates', async () => {
      const templates = await appletTemplateManager.listAppletTemplates();
      
      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe('basic-html');
      expect(templates[0].displayName).toBe('Basic HTML Applet');
      expect(templates[0].description).toBe('Simple HTML applet with frontend and backend function');
      expect(templates[1].name).toBe('react-app');
    });
    
    it('should handle errors and return an empty array', async () => {
      // Mock readDirAsync to throw an error
      fs.readdirAsync.mockRejectedValueOnce(new Error('Directory not found'));
      
      await expect(appletTemplateManager.listAppletTemplates()).rejects.toThrow('Failed to list applet templates');
    });
  });
  
  describe('getAppletTemplate', () => {
    it('should return a template by name', async () => {
      const template = await appletTemplateManager.getAppletTemplate('basic-html');
      
      expect(template.name).toBe('basic-html');
      expect(template.metadata.displayName).toBe('Basic HTML Applet');
    });
    
    it('should throw an error if template does not exist', async () => {
      await expect(appletTemplateManager.getAppletTemplate('non-existent'))
        .rejects.toThrow('Applet template "non-existent" not found');
    });
    
    it('should throw an error if template metadata is missing', async () => {
      // Mock template directory exists but metadata file doesn't
      fs.existsSync.mockImplementation((path) => {
        if (path === '/mock/templates/applets/invalid-template') {
          return true;
        }
        if (path === '/mock/templates/applets/invalid-template/template.json') {
          return false;
        }
        return !!mockFiles[path];
      });
      
      await expect(appletTemplateManager.getAppletTemplate('invalid-template'))
        .rejects.toThrow('Invalid applet template: Missing metadata file');
    });
  });
  
  describe('createAppletFromTemplate', () => {
    it('should create files from a template with variable substitution', async () => {
      const outputDir = '/output/my-applet';
      const variables = {
        appletName: 'Custom Applet Name'
      };
      
      // Mock the getAppletTemplate function
      const mockTemplate = {
        name: 'basic-html',
        metadata: {
          name: 'basic-html',
          displayName: 'Basic HTML Applet',
          files: [
            {
              source: 'applet.html',
              destination: 'applet.html',
              template: true
            },
            {
              source: 'function.js',
              destination: 'function.js',
              template: true
            }
          ]
        }
      };
      
      jest.spyOn(appletTemplateManager, 'getAppletTemplate').mockResolvedValue(mockTemplate);
      
      const result = await appletTemplateManager.createAppletFromTemplate('basic-html', outputDir, variables);
      
      // Verify directories were created
      expect(fs.mkdirAsync).toHaveBeenCalled();
      
      // Verify files were written
      expect(fs.readFileAsync).toHaveBeenCalledWith(`${mockTemplatesDir}/basic-html/applet.html`, 'utf8');
      expect(fs.readFileAsync).toHaveBeenCalledWith(`${mockTemplatesDir}/basic-html/function.js`, 'utf8');
      
      expect(fs.writeFileAsync).toHaveBeenCalledWith(
        `${outputDir}/applet.html`,
        expect.stringContaining('Custom Applet Name'),
        'utf8'
      );
      
      expect(result).toEqual({
        template: 'basic-html',
        outputDir,
        files: expect.any(Array)
      });
    });
    
    it('should throw error if template has no files', async () => {
      // Mock the getAppletTemplate function to return a template with no files
      const mockTemplate = {
        name: 'empty',
        metadata: {
          name: 'empty',
          displayName: 'Empty Template',
          files: []
        }
      };
      
      jest.spyOn(appletTemplateManager, 'getAppletTemplate').mockResolvedValue(mockTemplate);
      
      await expect(appletTemplateManager.createAppletFromTemplate('empty', '/output', {}))
        .rejects.toThrow('Template has no files defined');
    });
  });
  
  describe('validateTemplateVariables', () => {
    it('should validate required variables', async () => {
      // Mock getAppletTemplate to return a template with required variables
      const mockTemplate = {
        name: 'test',
        metadata: {
          variables: {
            requiredVar: { required: true },
            optionalVar: { required: false }
          }
        }
      };
      
      jest.spyOn(appletTemplateManager, 'getAppletTemplate').mockResolvedValue(mockTemplate);
      
      // Valid variables
      const validResult = await appletTemplateManager.validateTemplateVariables('test', {
        requiredVar: 'value',
        optionalVar: 'value'
      });
      
      expect(validResult.isValid).toBe(true);
      
      // Missing required variable
      const invalidResult = await appletTemplateManager.validateTemplateVariables('test', {
        optionalVar: 'value'
      });
      
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.missing).toContain('requiredVar');
    });
    
    it('should return valid if no variables defined in template', async () => {
      // Mock getAppletTemplate to return a template with no variables
      const mockTemplate = {
        name: 'test',
        metadata: {}
      };
      
      jest.spyOn(appletTemplateManager, 'getAppletTemplate').mockResolvedValue(mockTemplate);
      
      const result = await appletTemplateManager.validateTemplateVariables('test', {});
      
      expect(result.isValid).toBe(true);
    });
  });
  
  describe('getAppletTemplateEnvVars', () => {
    it('should return environment variables from template metadata', async () => {
      // Add environment variables to the mock files
      const templateWithEnvVars = {
        ...mockTemplates[0],
        environmentVariables: {
          API_KEY: 'your-api-key',
          SERVICE_URL: 'https://example.com/api'
        }
      };
      
      mockFiles['/mock/templates/applets/basic-html/template.json'] = JSON.stringify(templateWithEnvVars);
      
      const envVars = await appletTemplateManager.getAppletTemplateEnvVars('basic-html');
      
      expect(envVars).toEqual({
        API_KEY: 'your-api-key',
        SERVICE_URL: 'https://example.com/api'
      });
    });
    
    it('should return empty object if template has no environment variables', async () => {
      const envVars = await appletTemplateManager.getAppletTemplateEnvVars('react-app');
      expect(envVars).toEqual({});
    });
    
    it('should return empty object if template not found', async () => {
      const envVars = await appletTemplateManager.getAppletTemplateEnvVars('non-existent');
      expect(envVars).toEqual({});
    });
  });
});