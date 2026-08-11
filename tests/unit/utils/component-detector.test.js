/**
 * Unit tests for component detector utility
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import path from 'path';

// Mock specifiers resolve relative to tests/setup/setupTests.js, not this
// file. See the note at the bottom of that file.
// Mock the file system
const fsPromisesMock = {
  readFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn()
};
// The module under test uses a default import, so the mock must supply one.
jest.unstable_mockModule('fs/promises', () => ({
  __esModule: true,
  ...fsPromisesMock,
  default: fsPromisesMock
}));

// component-detector imports the named `glob` export, so mock that.
const globMock = jest.fn();
jest.unstable_mockModule('glob', () => ({
  __esModule: true,
  glob: globMock,
  default: globMock
}));

// Import after mocking
const fs = (await import('fs/promises')).default;
const { glob } = await import('glob');
const {
  isGliaFunction,
  isGliaApplet,
  detectKvNamespaces,
  findJavaScriptFiles,
  findHtmlFiles
} = await import('../../../src/utils/component-detector.js');

describe('Component Detector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isGliaFunction', () => {
    test('should detect Glia function with onInvoke pattern', async () => {
      // Arrange
      const filePath = '/test/function.js';
      const content = `
        export async function onInvoke(request, env, kvStoreFactory) {
          // Function code
        }
      `;
      fs.readFile.mockResolvedValueOnce(content);
      
      // Act
      const result = await isGliaFunction(filePath);
      
      // Assert
      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf8');
    });
    
    test('should detect Glia function with arrow function pattern', async () => {
      // Arrange
      const filePath = '/test/function.js';
      const content = `
        export const onInvoke = async (request, env, kvStoreFactory) => {
          // Function code
        };
      `;
      fs.readFile.mockResolvedValueOnce(content);
      
      // Act
      const result = await isGliaFunction(filePath);
      
      // Assert
      expect(result).toBe(true);
    });
    
    test('should not detect non-Glia function', async () => {
      // Arrange
      const filePath = '/test/not-function.js';
      const content = `
        function regularFunction() {
          // Regular function
        }
      `;
      fs.readFile.mockResolvedValueOnce(content);
      
      // Act
      const result = await isGliaFunction(filePath);
      
      // Assert
      expect(result).toBe(false);
    });
    
    test('should handle file read errors', async () => {
      // Arrange
      const filePath = '/test/missing.js';
      fs.readFile.mockRejectedValueOnce(new Error('File not found'));
      
      // Act
      const result = await isGliaFunction(filePath);
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isGliaApplet', () => {
    test('should detect Glia applet with glia-widget tag', async () => {
      // Arrange
      const filePath = '/test/applet.html';
      const content = `
        <html>
          <body>
            <glia-widget id="widget"></glia-widget>
          </body>
        </html>
      `;
      fs.readFile.mockResolvedValueOnce(content);
      
      // Act
      const result = await isGliaApplet(filePath);
      
      // Assert
      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf8');
    });
    
    test('should detect Glia applet with glia.chat reference', async () => {
      // Arrange
      const filePath = '/test/applet.html';
      const content = `
        <html>
          <script>
            glia.chat.initialize();
          </script>
        </html>
      `;
      fs.readFile.mockResolvedValueOnce(content);
      
      // Act
      const result = await isGliaApplet(filePath);
      
      // Assert
      expect(result).toBe(true);
    });
    
    test('should not detect non-Glia applet', async () => {
      // Arrange
      const filePath = '/test/regular.html';
      const content = `
        <html>
          <body>
            <div>Regular HTML</div>
          </body>
        </html>
      `;
      fs.readFile.mockResolvedValueOnce(content);
      
      // Act
      const result = await isGliaApplet(filePath);
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('detectKvNamespaces', () => {
    test('should detect direct KV namespace initialization', async () => {
      // Arrange
      const filePath = '/test/function.js';
      const content = `
        export async function onInvoke(request, env, kvStoreFactory) {
          const store = kvStoreFactory.initializeKvStore('user_data');
          // Function code
        }
      `;
      fs.readFile.mockResolvedValueOnce(content);
      
      // Act
      const result = await detectKvNamespaces(filePath);
      
      // Assert
      expect(result).toContain('user_data');
    });
    
    test('should detect KV namespace from environment variable with fallback', async () => {
      // Arrange
      const filePath = '/test/function.js';
      const content = `
        export async function onInvoke(request, env, kvStoreFactory) {
          const namespace = env.KV_NAMESPACE || 'default_namespace';
          const store = kvStoreFactory.initializeKvStore(namespace);
          // Function code
        }
      `;
      fs.readFile.mockResolvedValueOnce(content);
      
      // Act
      const result = await detectKvNamespaces(filePath);
      
      // Assert
      expect(result).toContain('default_namespace');
    });
  });

  describe('findJavaScriptFiles', () => {
    test('should find all JS files in a directory', async () => {
      // Arrange
      const directory = '/test/project';
      const jsFiles = ['/test/project/function1.js', '/test/project/function2.js'];
      // glob v10 returns a promise; the callback form is long gone.
      glob.mockResolvedValueOnce(jsFiles);
      
      // Act
      const result = await findJavaScriptFiles(directory);
      
      // Assert
      expect(result).toEqual(jsFiles);
      expect(glob.mock.calls[0][0]).toMatch(/\.js$/);
    });
  });

  describe('findHtmlFiles', () => {
    test('should find all HTML files in a directory', async () => {
      // Arrange
      const directory = '/test/project';
      const htmlFiles = ['/test/project/applet1.html', '/test/project/applet2.html'];
      // glob v10 returns a promise; the callback form is long gone.
      glob.mockResolvedValueOnce(htmlFiles);
      
      // Act
      const result = await findHtmlFiles(directory);
      
      // Assert
      expect(result).toEqual(htmlFiles);
      expect(glob.mock.calls[0][0]).toMatch(/\.html$/);
    });
  });
});