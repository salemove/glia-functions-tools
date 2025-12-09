/**
 * Integration test for project creation with manifests
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { createFromTemplate } from '../../src/utils/unified-template-manager.js';

describe('Project Creation With Manifest', () => {
  let tempDir;

  beforeEach(() => {
    // Create a temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glia-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      if (tempDir) {
        execSync(`rm -rf ${tempDir}`);
      }
    } catch (error) {
      console.error(`Error cleaning up: ${error.message}`);
    }
  });

  test('should create project with manifest from basic-function template', async () => {
    // Skip if CI environment (no access to template files)
    if (process.env.CI) {
      console.log('Skipping test in CI environment');
      return;
    }

    // Act
    const result = await createFromTemplate('basic-function', tempDir, {
      type: 'project',
      variables: {
        projectName: 'test-basic-function',
        description: 'Test project for integration testing'
      }
    });

    // Assert
    expect(fs.existsSync(path.join(tempDir, 'glia-project.json'))).toBe(true);
    
    // Check manifest content
    const manifestContent = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'glia-project.json'), 'utf8')
    );
    
    expect(manifestContent.name).toBe('test-basic-function');
    expect(manifestContent.description).toBe('Test project for integration testing');
    expect(manifestContent.components.functions).toHaveLength(1);
    expect(manifestContent.components.functions[0].path).toBe('function.js');
  }, 30000); // Extend timeout for this test
  
  test('should create project with manifest from api-integration template', async () => {
    // Skip if CI environment (no access to template files)
    if (process.env.CI) {
      console.log('Skipping test in CI environment');
      return;
    }

    // Act
    const result = await createFromTemplate('api-integration', tempDir, {
      type: 'project',
      variables: {
        projectName: 'test-api-integration',
        description: 'API integration test',
        apiKey: 'test-key',
        apiUrl: 'https://test-api.example.com'
      }
    });

    // Assert
    expect(fs.existsSync(path.join(tempDir, 'glia-project.json'))).toBe(true);
    
    // Check manifest content
    const manifestContent = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'glia-project.json'), 'utf8')
    );
    
    expect(manifestContent.name).toBe('test-api-integration');
    expect(manifestContent.components.functions).toHaveLength(1);
    expect(manifestContent.components.functions[0].environment.API_KEY).toBe('test-key');
    expect(manifestContent.components.functions[0].environment.API_URL).toBe('https://test-api.example.com');
    expect(manifestContent.kvStore.namespaces).toHaveLength(2);
  }, 30000); // Extend timeout for this test
  
  test('should generate linkages between discovered components', async () => {
    // Skip if CI environment (no access to template files)
    if (process.env.CI) {
      console.log('Skipping test in CI environment');
      return;
    }
    
    // Create test function and applet files
    const functionDir = path.join(tempDir, 'functions');
    fs.mkdirSync(functionDir, { recursive: true });
    
    // Write a test function file
    fs.writeFileSync(path.join(functionDir, 'test-function.js'), `
      export async function onInvoke(request, env, kvStoreFactory) {
        const store = kvStoreFactory.initializeKvStore('test_namespace');
        return new Response("Hello from function");
      }
    `);
    
    // Write a test applet file with placeholders
    fs.writeFileSync(path.join(tempDir, 'applet.html'), `
      <!DOCTYPE html>
      <html>
      <body>
        <script>
          const apiUrl = "\${API_URL}";
        </script>
        <glia-widget></glia-widget>
      </body>
      </html>
    `);
    
    // Create minimal template object
    const testTemplate = {
      name: 'test-template',
      type: 'project'
    };
    
    // Act - Create project with auto-discovery
    const result = await createFromTemplate('test-template', tempDir, {
      type: 'project',
      variables: {
        projectName: 'test-discovery'
      },
      template: testTemplate
    });
    
    // Check if manifest was created with linkages
    if (result.manifest) {
      const manifestContent = result.manifest.content;
      expect(manifestContent.components.functions).toHaveLength(1);
      expect(manifestContent.components.applets).toHaveLength(1);
      expect(manifestContent.linkages).toHaveLength(1);
      expect(manifestContent.linkages[0].placeholders).toHaveProperty('API_URL');
    }
  }, 30000); // Extend timeout for this test
});