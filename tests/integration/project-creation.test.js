/**
 * Integration test for project creation with manifests
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createFromTemplate } from '../../src/utils/unified-template-manager.js';
import { autoDiscoverComponents } from '../../src/utils/project-manifest-processor.js';

describe('Project Creation With Manifest', () => {
  let tempDir;

  beforeEach(() => {
    // Create a temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glia-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
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
    expect(manifestContent.description).toBe('API integration test');
    expect(manifestContent.components.functions).toHaveLength(1);
    expect(manifestContent.components.functions[0].path).toBe('function.js');
    
    // The template ships no `projectManifest` section, so the manifest is
    // produced entirely by auto-discovery: it finds the function file and
    // records no environment variables, KV namespaces or linkages. The previous
    // assertions here expected declared env vars and two namespaces, which no
    // template has ever provided.
    expect(manifestContent.kvStore.namespaces).toEqual([]);
    expect(manifestContent.linkages).toEqual([]);
    
    // The variables themselves land in the generated .env, not the manifest.
    const envFile = fs.readFileSync(path.join(tempDir, '.env'), 'utf8');
    expect(envFile).toContain('test-key');
    expect(envFile).toContain('https://test-api.example.com');
  }, 30000); // Extend timeout for this test
  
  // Auto-discovery is exercised directly rather than through createFromTemplate:
  // the previous version of this test passed a `template` object for a template
  // name that does not exist, and createFromTemplate resolves by name only, so
  // it could only ever throw.
  test('should discover functions, applets and KV namespaces on disk', async () => {
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
    
    const manifest = {
      name: 'test-discovery',
      version: '1.0.0',
      components: { functions: [], applets: [] },
      kvStore: { namespaces: [] },
      linkages: []
    };
    
    await autoDiscoverComponents(manifest, tempDir);
    
    expect(manifest.components.functions).toHaveLength(1);
    expect(manifest.components.functions[0].path).toBe(path.join('functions', 'test-function.js'));
    expect(manifest.components.applets).toHaveLength(1);
    expect(manifest.components.applets[0].path).toBe('applet.html');
    
    // The function initialises a KV store, so the namespace is picked up.
    expect(manifest.kvStore.namespaces.map(ns => ns.name)).toContain('test_namespace');
  }, 30000); // Extend timeout for this test
});