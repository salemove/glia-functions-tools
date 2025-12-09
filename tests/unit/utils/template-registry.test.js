import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock filesystem modules
jest.mock('fs');
jest.mock('path');

// Import the module under test
import * as templateRegistry from '../../../src/utils/template-registry.js';

describe('templateRegistry', () => {
  // Define base template paths for testing
  const basePaths = {
    function: '/mock/templates/functions',
    project: '/mock/templates/projects',
    applet: '/mock/templates/applets',
    custom: '/mock/custom-templates'
  };
  
  // Mock template data
  const mockTemplates = {
    // Function templates
    'basic': {
      name: 'basic',
      displayName: 'Basic Function',
      description: 'A basic function template',
      type: 'function',
      version: '1.0.0',
      tags: ['function', 'basic']
    },
    'api-integration': {
      name: 'api-integration',
      displayName: 'API Integration',
      description: 'Template for API integration',
      type: 'function',
      version: '1.0.0',
      tags: ['function', 'api']
    },
    // Project templates
    'basic-project': {
      name: 'basic-project',
      displayName: 'Basic Project',
      description: 'A basic project template',
      type: 'project',
      version: '1.0.0',
      tags: ['project', 'basic']
    },
    // Project templates with inheritance
    'parent-template': {
      name: 'parent-template',
      displayName: 'Parent Template',
      description: 'A parent template for inheritance',
      type: 'project',
      version: '1.0.0',
      tags: ['project', 'parent'],
      files: ['file1.js', 'file2.js', 'README.md'],
      variables: {
        projectName: { default: 'parent-project', required: true },
        description: { default: 'Parent project description', required: true }
      },
      dependencies: ['parent-dep1', 'parent-dep2'],
      devDependencies: ['parent-dev1'],
      envVars: { PARENT_VAR: 'parent-value' },
      postInit: ['Parent init action']
    },
    'child-template': {
      name: 'child-template',
      displayName: 'Child Template',
      description: 'A child template that extends parent',
      type: 'project',
      version: '1.0.0',
      tags: ['project', 'child'],
      extends: 'parent-template',
      files: ['file3.js', '!file2.js'], // Add file3, remove file2
      variables: {
        projectName: { default: 'child-project', required: true },
        childVar: { default: 'child-value', required: false }
      },
      dependencies: ['child-dep1'],
      devDependencies: ['child-dev1'],
      envVars: { CHILD_VAR: 'child-value' },
      postInit: ['Child init action']
    },
    // Applet templates
    'basic-html': {
      name: 'basic-html',
      displayName: 'Basic HTML Applet',
      description: 'Simple HTML applet',
      type: 'applet',
      version: '1.0.0',
      tags: ['applet', 'html']
    },
    'react-app': {
      name: 'react-app',
      displayName: 'React Applet',
      description: 'React-based applet',
      type: 'applet',
      version: '1.0.0',
      tags: ['applet', 'react']
    }
  };
  
  // Mock directory structure
  const mockDirStructure = {
    [basePaths.function]: ['basic', 'api-integration', 'not-a-template.txt'],
    [basePaths.project]: ['basic-project', 'parent-template', 'child-template', 'empty-dir'],
    [basePaths.applet]: ['basic-html', 'react-app', 'invalid-template']
  };
  
  // Mock file paths and content
  const mockFiles = {
    [`${basePaths.function}/basic/template.json`]: JSON.stringify(mockTemplates.basic),
    [`${basePaths.function}/api-integration/template.json`]: JSON.stringify(mockTemplates['api-integration']),
    [`${basePaths.project}/basic-project/template.json`]: JSON.stringify(mockTemplates['basic-project']),
    [`${basePaths.project}/parent-template/template.json`]: JSON.stringify(mockTemplates['parent-template']),
    [`${basePaths.project}/child-template/template.json`]: JSON.stringify(mockTemplates['child-template']),
    [`${basePaths.applet}/basic-html/template.json`]: JSON.stringify(mockTemplates['basic-html']),
    [`${basePaths.applet}/react-app/template.json`]: JSON.stringify(mockTemplates['react-app']),
    [`${basePaths.applet}/invalid-template/template.json`]: '{ invalid json',
    // Mock template files
    [`${basePaths.project}/parent-template/file1.js`]: 'console.log("Parent file 1");',
    [`${basePaths.project}/parent-template/file2.js`]: 'console.log("Parent file 2");',
    [`${basePaths.project}/parent-template/README.md`]: '# Parent Project\nThis is the parent template.',
    [`${basePaths.project}/child-template/file3.js`]: 'console.log("Child file 3");',
  };

  // Setup before each test
  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();
    
    // Setup path mock
    jest.spyOn(path, 'resolve').mockImplementation((...args) => args.join('/'));
    jest.spyOn(path, 'join').mockImplementation((...args) => args.join('/'));
    jest.spyOn(path, 'dirname').mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
    
    // Mock file existence
    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      // Base directories exist
      if (Object.values(basePaths).includes(filePath)) return true;
      // Template directories exist
      for (const [dir, entries] of Object.entries(mockDirStructure)) {
        for (const entry of entries) {
          if (filePath === `${dir}/${entry}`) return true;
        }
      }
      // Check if file exists in our mockFiles
      return !!mockFiles[filePath];
    });
    
    // Mock readdirAsync
    fs.readdirAsync = jest.fn();
    fs.readdirAsync.mockImplementation((dirPath) => {
      if (mockDirStructure[dirPath]) {
        return Promise.resolve(mockDirStructure[dirPath]);
      }
      return Promise.reject(new Error(`Directory not found: ${dirPath}`));
    });
    
    // Mock statAsync
    fs.statAsync = jest.fn();
    fs.statAsync.mockImplementation((path) => {
      // Directories
      for (const [dir, entries] of Object.entries(mockDirStructure)) {
        for (const entry of entries) {
          if (path === `${dir}/${entry}`) {
            return Promise.resolve({
              isDirectory: () => true,
              isFile: () => false
            });
          }
        }
      }
      // Files
      if (mockFiles[path]) {
        return Promise.resolve({
          isDirectory: () => false,
          isFile: () => true
        });
      }
      return Promise.reject(new Error(`Path not found: ${path}`));
    });
    
    // Mock readFileAsync
    fs.readFileAsync = jest.fn();
    fs.readFileAsync.mockImplementation((filePath, encoding) => {
      if (mockFiles[filePath]) {
        return Promise.resolve(mockFiles[filePath]);
      }
      return Promise.reject(new Error(`File not found: ${filePath}`));
    });
    
    // Override the BASE_TEMPLATE_PATHS property for testing
    templateRegistry.BASE_TEMPLATE_PATHS = basePaths;
    
    // Reset templateRegistry cache
    Object.defineProperty(templateRegistry, 'templateRegistry', {
      value: null,
      configurable: true
    });
  });

  describe('readTemplateMetadata', () => {
    it('should read and parse template metadata', async () => {
      const { readTemplateMetadata } = templateRegistry;
      const result = await readTemplateMetadata(`${basePaths.function}/basic`);
      
      expect(result).toEqual(expect.objectContaining({
        name: 'basic',
        displayName: 'Basic Function',
        type: 'function',
        path: `${basePaths.function}/basic`
      }));
    });
    
    it('should return null for missing template.json', async () => {
      const { readTemplateMetadata } = templateRegistry;
      const result = await readTemplateMetadata(`${basePaths.project}/empty-dir`);
      
      expect(result).toBeNull();
    });
    
    it('should return null for invalid JSON', async () => {
      const { readTemplateMetadata } = templateRegistry;
      const result = await readTemplateMetadata(`${basePaths.applet}/invalid-template`);
      
      expect(result).toBeNull();
    });
    
    it('should return null for templates missing required fields', async () => {
      const { readTemplateMetadata } = templateRegistry;
      
      // Mock a template without required name field
      mockFiles[`${basePaths.function}/missing-name/template.json`] = JSON.stringify({
        description: 'Missing name field',
        type: 'function'
      });
      
      mockDirStructure[basePaths.function].push('missing-name');
      
      const result = await readTemplateMetadata(`${basePaths.function}/missing-name`);
      expect(result).toBeNull();
    });
  });
  
  describe('discoverTemplates', () => {
    it('should discover templates in a directory', async () => {
      const { discoverTemplates } = templateRegistry;
      const result = await discoverTemplates(basePaths.function, 'function');
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('basic');
      expect(result[1].name).toBe('api-integration');
    });
    
    it('should skip non-directories', async () => {
      const { discoverTemplates } = templateRegistry;
      
      // Add a file to mock structure
      mockDirStructure[basePaths.function].push('file.txt');
      fs.statAsync.mockImplementationOnce((path) => {
        if (path === `${basePaths.function}/file.txt`) {
          return Promise.resolve({
            isDirectory: () => false,
            isFile: () => true
          });
        }
      });
      
      const result = await discoverTemplates(basePaths.function, 'function');
      
      // Should still return only valid directories
      expect(result).toHaveLength(2);
    });
    
    it('should handle missing directories', async () => {
      const { discoverTemplates } = templateRegistry;
      const result = await discoverTemplates('/non-existent-dir', 'function');
      
      expect(result).toEqual([]);
    });
    
    it('should apply the provided type if template has none', async () => {
      const { discoverTemplates } = templateRegistry;
      
      // Mock a template without type
      mockFiles[`${basePaths.function}/no-type/template.json`] = JSON.stringify({
        name: 'no-type',
        description: 'Template without type'
      });
      
      mockDirStructure[basePaths.function].push('no-type');
      
      const result = await discoverTemplates(basePaths.function, 'function');
      
      // Find the template without type
      const noTypeTemplate = result.find(t => t.name === 'no-type');
      expect(noTypeTemplate).toBeDefined();
      expect(noTypeTemplate.type).toBe('function');
    });
  });
  
  describe('readTemplateRegistry', () => {
    it('should build a complete registry with all templates', async () => {
      const { readTemplateRegistry } = templateRegistry;
      const registry = await readTemplateRegistry(true); // Force refresh
      
      expect(registry.templates).toHaveLength(7);
      expect(Object.keys(registry.byName)).toHaveLength(7);
      expect(Object.keys(registry.byType)).toEqual(expect.arrayContaining(['function', 'project', 'applet']));
      expect(registry.byType.function).toHaveLength(2);
      expect(registry.byType.project).toHaveLength(3);
      expect(registry.byType.applet).toHaveLength(2);
    });
    
    it('should use cached registry when available and not forced to refresh', async () => {
      const { readTemplateRegistry } = templateRegistry;
      
      // First call should build the registry
      const registry1 = await readTemplateRegistry();
      
      // Modify the cache to test it's being used
      registry1.testFlag = 'test-value';
      Object.defineProperty(templateRegistry, 'templateRegistry', {
        value: registry1,
        configurable: true
      });
      
      // Second call without refresh should use cache
      const registry2 = await readTemplateRegistry();
      expect(registry2.testFlag).toBe('test-value');
      
      // Third call with refresh should rebuild
      const registry3 = await readTemplateRegistry(true);
      expect(registry3.testFlag).toBeUndefined();
    });
    
    it('should index templates by tag', async () => {
      const { readTemplateRegistry } = templateRegistry;
      const registry = await readTemplateRegistry(true);
      
      expect(registry.byTag).toBeDefined();
      expect(registry.byTag.basic).toHaveLength(2); // Both function and project templates
      expect(registry.byTag.api).toHaveLength(1);
      expect(registry.byTag.applet).toHaveLength(2);
    });
    
    it('should handle templates with missing tags', async () => {
      const { readTemplateRegistry } = templateRegistry;
      
      // Mock a template without tags
      mockFiles[`${basePaths.function}/no-tags/template.json`] = JSON.stringify({
        name: 'no-tags',
        description: 'Template without tags',
        type: 'function'
      });
      
      mockDirStructure[basePaths.function].push('no-tags');
      
      const registry = await readTemplateRegistry(true);
      
      // Should still include the template
      expect(registry.templates).toContainEqual(
        expect.objectContaining({
          name: 'no-tags'
        })
      );
    });
  });
  
  describe('getTemplateByName', () => {
    it('should return a template by name', async () => {
      const { getTemplateByName } = templateRegistry;
      const template = await getTemplateByName('api-integration');
      
      expect(template).toBeDefined();
      expect(template.name).toBe('api-integration');
      expect(template.type).toBe('function');
    });
    
    it('should return null for non-existent templates', async () => {
      const { getTemplateByName } = templateRegistry;
      const template = await getTemplateByName('non-existent-template');
      
      expect(template).toBeNull();
    });
    
    it('should refresh the registry when forced', async () => {
      const { getTemplateByName, readTemplateRegistry } = templateRegistry;
      
      // First get a template normally
      const template1 = await getTemplateByName('api-integration');
      expect(template1.name).toBe('api-integration');
      
      // Modify the registry cache
      const registry = await readTemplateRegistry();
      registry.byName['api-integration'].testFlag = 'test-value';
      
      // Get without refresh should use cache
      const template2 = await getTemplateByName('api-integration');
      expect(template2.testFlag).toBe('test-value');
      
      // Get with refresh should rebuild
      const template3 = await getTemplateByName('api-integration', true);
      expect(template3.testFlag).toBeUndefined();
    });
    
    it('should resolve template inheritance when requested', async () => {
      const { getTemplateByName } = templateRegistry;
      
      // Get template without resolving inheritance
      const childTemplate = await getTemplateByName('child-template', false, false);
      expect(childTemplate.name).toBe('child-template');
      expect(childTemplate.extends).toBe('parent-template');
      expect(childTemplate.files).toEqual(['file3.js', '!file2.js']);
      
      // Get template with inheritance resolved
      const resolvedTemplate = await getTemplateByName('child-template', false, true);
      expect(resolvedTemplate.name).toBe('child-template');
      expect(resolvedTemplate.extends).toBe('parent-template');
      
      // Should have merged files (include file1, file3, exclude file2)
      expect(resolvedTemplate.files).toContain('file1.js');
      expect(resolvedTemplate.files).toContain('file3.js');
      expect(resolvedTemplate.files).toContain('README.md');
      expect(resolvedTemplate.files).not.toContain('file2.js');
      
      // Should have merged variables
      expect(resolvedTemplate.variables.projectName.default).toBe('child-project');
      expect(resolvedTemplate.variables.description.default).toBe('Parent project description');
      expect(resolvedTemplate.variables.childVar.default).toBe('child-value');
      
      // Should have merged dependencies
      expect(resolvedTemplate.dependencies).toContain('parent-dep1');
      expect(resolvedTemplate.dependencies).toContain('parent-dep2');
      expect(resolvedTemplate.dependencies).toContain('child-dep1');
      
      // Should have merged dev dependencies
      expect(resolvedTemplate.devDependencies).toContain('parent-dev1');
      expect(resolvedTemplate.devDependencies).toContain('child-dev1');
      
      // Should have merged environment variables
      expect(resolvedTemplate.envVars.PARENT_VAR).toBe('parent-value');
      expect(resolvedTemplate.envVars.CHILD_VAR).toBe('child-value');
      
      // Should have merged post init actions
      expect(resolvedTemplate.postInit).toContain('Parent init action');
      expect(resolvedTemplate.postInit).toContain('Child init action');
      
      // Should include _resolved flag
      expect(resolvedTemplate._resolved).toBe(true);
      
      // Should include ancestry information
      expect(resolvedTemplate._resolvedFrom).toEqual(['parent-template']);
    });
  });
  
  describe('listTemplates', () => {
    it('should list all templates when no filter provided', async () => {
      const { listTemplates } = templateRegistry;
      const templates = await listTemplates();
      
      expect(templates).toHaveLength(5);
    });
    
    it('should filter templates by type', async () => {
      const { listTemplates } = templateRegistry;
      
      const functionTemplates = await listTemplates({ type: 'function' });
      expect(functionTemplates).toHaveLength(2);
      expect(functionTemplates[0].type).toBe('function');
      
      const appletTemplates = await listTemplates({ type: 'applet' });
      expect(appletTemplates).toHaveLength(2);
      expect(appletTemplates[0].type).toBe('applet');
    });
    
    it('should filter templates by tag', async () => {
      const { listTemplates } = templateRegistry;
      
      const basicTemplates = await listTemplates({ tag: 'basic' });
      expect(basicTemplates).toHaveLength(2);
      
      const reactTemplates = await listTemplates({ tag: 'react' });
      expect(reactTemplates).toHaveLength(1);
      expect(reactTemplates[0].name).toBe('react-app');
    });
    
    it('should filter templates by search term', async () => {
      const { listTemplates } = templateRegistry;
      
      const apiTemplates = await listTemplates({ search: 'api' });
      expect(apiTemplates).toHaveLength(1);
      expect(apiTemplates[0].name).toBe('api-integration');
      
      // Search in description
      const simpleTemplates = await listTemplates({ search: 'simple' });
      expect(simpleTemplates).toHaveLength(1);
      expect(simpleTemplates[0].name).toBe('basic-html');
      
      // Search in tags
      const htmlTemplates = await listTemplates({ search: 'html' });
      expect(htmlTemplates).toHaveLength(1);
      expect(htmlTemplates[0].name).toBe('basic-html');
    });
    
    it('should combine multiple filters', async () => {
      const { listTemplates } = templateRegistry;
      
      // Type + Tag
      const basicFunctionTemplates = await listTemplates({ 
        type: 'function', 
        tag: 'basic' 
      });
      
      expect(basicFunctionTemplates).toHaveLength(1);
      expect(basicFunctionTemplates[0].name).toBe('basic');
    });
    
    it('should return empty array when no templates match filters', async () => {
      const { listTemplates } = templateRegistry;
      
      const templates = await listTemplates({ 
        type: 'function', 
        tag: 'non-existent' 
      });
      
      expect(templates).toEqual([]);
    });
    
    it('should force refresh registry when requested', async () => {
      const { listTemplates, readTemplateRegistry } = templateRegistry;
      
      // First list templates normally
      const templates1 = await listTemplates();
      expect(templates1).toHaveLength(5);
      
      // Add a test flag to the registry
      const registry = await readTemplateRegistry();
      registry.templates.forEach(t => t.testFlag = 'test-value');
      
      // List without refresh should show flags
      const templates2 = await listTemplates();
      expect(templates2[0].testFlag).toBe('test-value');
      
      // List with refresh should not have flags
      const templates3 = await listTemplates({ refresh: true });
      expect(templates3[0].testFlag).toBeUndefined();
    });
  });
  
  describe('resolveTemplateInheritance', () => {
    it('should properly resolve template inheritance', async () => {
      const { resolveTemplateInheritance } = templateRegistry;
      
      // Get raw child template without inheritance
      const childTemplate = mockTemplates['child-template'];
      
      // Resolve inheritance
      const resolved = await resolveTemplateInheritance(childTemplate);
      
      // Should have merged variables
      expect(resolved.variables).toEqual({
        projectName: { default: 'child-project', required: true },
        description: { default: 'Parent project description', required: true },
        childVar: { default: 'child-value', required: false }
      });
      
      // Should have properly merged files (excluding file2.js)
      expect(resolved.files).toContain('file1.js');
      expect(resolved.files).toContain('file3.js');
      expect(resolved.files).toContain('README.md');
      expect(resolved.files).not.toContain('file2.js');
      
      // Should have merged dependencies
      expect(resolved.dependencies).toContain('parent-dep1');
      expect(resolved.dependencies).toContain('parent-dep2');
      expect(resolved.dependencies).toContain('child-dep1');
      
      // Should have merged postInit
      expect(resolved.postInit).toEqual(['Parent init action', 'Child init action']);
    });
    
    it('should handle circular inheritance', async () => {
      const { resolveTemplateInheritance } = templateRegistry;
      
      // Create circular inheritance
      const circularParent = {
        name: 'circular-parent',
        extends: 'circular-child',
        files: ['parent.js']
      };
      
      const circularChild = {
        name: 'circular-child',
        extends: 'circular-parent',
        files: ['child.js']
      };
      
      // Mock getTemplateByName to return our circular templates
      jest.spyOn(templateRegistry, 'getTemplateByName').mockImplementation(async (name, refresh, resolve) => {
        if (name === 'circular-parent') return circularParent;
        if (name === 'circular-child') return circularChild;
        return null;
      });
      
      // Should still resolve without infinite recursion
      const resolved = await resolveTemplateInheritance(circularParent);
      
      // Should have base properties and not crash
      expect(resolved.name).toBe('circular-parent');
      expect(resolved.files).toContain('parent.js');
    });
    
    it('should handle missing parent templates', async () => {
      const { resolveTemplateInheritance } = templateRegistry;
      
      // Create template with missing parent
      const template = {
        name: 'orphan-template',
        extends: 'non-existent-parent',
        files: ['orphan.js']
      };
      
      // Should resolve without error
      const resolved = await resolveTemplateInheritance(template);
      
      // Should still have original properties
      expect(resolved.name).toBe('orphan-template');
      expect(resolved.files).toContain('orphan.js');
    });
  });
  
  describe('registerCustomTemplate', () => {
    it('should register a valid custom template', async () => {
      const { registerCustomTemplate, listTemplates } = templateRegistry;
      
      // Mock custom template
      const customTemplatePath = '/custom/my-template';
      mockFiles[`${customTemplatePath}/template.json`] = JSON.stringify({
        name: 'my-custom-template',
        displayName: 'My Custom Template',
        description: 'A custom template',
        type: 'function',
        version: '1.0.0'
      });
      
      fs.existsSync.mockImplementation((path) => {
        if (path === customTemplatePath || path === `${customTemplatePath}/template.json`) {
          return true;
        }
        return false;
      });
      
      fs.statAsync.mockImplementation((path) => {
        if (path === `${customTemplatePath}/template.json`) {
          return Promise.resolve({
            isDirectory: () => false,
            isFile: () => true
          });
        }
        return Promise.reject(new Error(`Path not found: ${path}`));
      });
      
      // Ensure custom template directory can be created
      fs.mkdirSync = jest.fn();
      
      // Register the template
      const template = await registerCustomTemplate(customTemplatePath);
      
      // Verify template was returned
      expect(template).toBeDefined();
      expect(template.name).toBe('my-custom-template');
      
      // Verify template was added to registry
      const templates = await listTemplates({ refresh: true });
      expect(templates).toContainEqual(
        expect.objectContaining({
          name: 'my-custom-template'
        })
      );
    });
    
    it('should throw for invalid custom templates', async () => {
      const { registerCustomTemplate } = templateRegistry;
      
      // Mock invalid template path
      const invalidPath = '/custom/invalid-template';
      
      fs.existsSync.mockImplementation((path) => {
        if (path === invalidPath) {
          return true;
        }
        return false;
      });
      
      // Should throw for missing template.json
      await expect(registerCustomTemplate(invalidPath)).rejects.toThrow('Invalid template');
      
      // Should throw for invalid JSON
      fs.existsSync.mockImplementation((path) => {
        if (path === invalidPath || path === `${invalidPath}/template.json`) {
          return true;
        }
        return false;
      });
      
      fs.readFileAsync.mockImplementation((path) => {
        if (path === `${invalidPath}/template.json`) {
          return Promise.resolve('{ invalid json');
        }
        return Promise.reject(new Error(`File not found: ${path}`));
      });
      
      await expect(registerCustomTemplate(invalidPath)).rejects.toThrow('Failed to register custom template');
    });
  });
});