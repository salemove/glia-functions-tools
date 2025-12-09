import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { dev } from '../../../src/commands/dev.js';
import * as fs from 'fs';
import * as http from 'http';
import { spawn } from 'child_process';
import { Miniflare } from 'miniflare';
import * as configModule from '../../../src/lib/config.js';

// Mock dependencies
jest.mock('fs', () => {
  const originalModule = jest.requireActual('fs');
  return {
    ...originalModule,
    existsSync: jest.fn(),
    promises: {
      readFile: jest.fn(),
    },
    watchFile: jest.fn(),
  };
});

jest.mock('http');
jest.mock('child_process');
jest.mock('miniflare');
jest.mock('../../../src/lib/config.js');

describe('dev command', () => {
  // Setup mocks
  const mockApiConfig = {
    apiUrl: 'https://test-api.glia.com',
    siteId: 'test-site-id',
    bearerToken: 'test-bearer-token'
  };
  
  let mockServer;
  let mockServerListen;
  let mockMiniflareInstance;
  let mockChildProcess;
  let consoleLogSpy;
  let consoleErrorSpy;
  
  beforeEach(() => {
    // Setup mock function file
    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue('// Function code');
    
    // Setup mock HTTP server
    mockServerListen = jest.fn((port, callback) => callback());
    mockServer = {
      listen: mockServerListen,
      close: jest.fn()
    };
    
    http.createServer.mockReturnValue(mockServer);
    
    // Setup mock Miniflare
    mockMiniflareInstance = {
      dispatchFetch: jest.fn().mockResolvedValue({
        status: 200,
        headers: new Map([['Content-Type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('{"message":"ok"}')),
      }),
      getGlobalScope: jest.fn().mockResolvedValue({}),
      dispose: jest.fn()
    };
    
    Miniflare.mockImplementation(() => mockMiniflareInstance);
    
    // Setup mock child process
    mockChildProcess = {
      stdout: {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('Build completed'));
          }
        }),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          callback(0); // Exit code 0
        }
      }),
      kill: jest.fn()
    };
    
    spawn.mockReturnValue(mockChildProcess);
    
    // Setup config mock
    configModule.getApiConfig.mockResolvedValue(mockApiConfig);
    
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock setTimeout to execute immediately
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    jest.useRealTimers();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
  
  it('should start a development server with default options', async () => {
    // Call the function
    const result = await dev({
      path: '/path/to/function.js',
      port: 8787
    });
    
    // Fast-forward all timers
    jest.runAllTimers();
    
    // Verify function file was checked
    expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('function.js'));
    
    // Verify esbuild was called
    expect(spawn).toHaveBeenCalledWith('npm', ['run', 'build', '--', '/path/to/function.js'], expect.any(Object));
    
    // Verify function code was read
    expect(fs.promises.readFile).toHaveBeenCalled();
    
    // Verify Miniflare was initialized
    expect(Miniflare).toHaveBeenCalled();
    
    // Verify HTTP server was created and started
    expect(http.createServer).toHaveBeenCalled();
    expect(mockServer.listen).toHaveBeenCalledWith(8787, expect.any(Function));
    
    // Verify result
    expect(result).toEqual(expect.objectContaining({
      url: 'http://localhost:8787',
      port: 8787,
      functionPath: expect.any(String),
    }));
  });
  
  it('should handle watch mode', async () => {
    // Call the function with watch mode enabled
    await dev({
      path: '/path/to/function.js',
      port: 8787,
      watch: true
    });
    
    // Fast-forward all timers
    jest.runAllTimers();
    
    // Verify file watcher was set up
    expect(fs.watchFile).toHaveBeenCalledWith(
      expect.stringContaining('function.js'),
      expect.any(Object),
      expect.any(Function)
    );
  });
  
  it('should handle errors with invalid path', async () => {
    // Mock function file not found
    fs.existsSync.mockReturnValue(false);
    
    // Verify function throws error
    await expect(dev({ path: '/nonexistent/path.js' }))
      .rejects.toThrow('Function file not found');
  });
  
  it('should handle build failure', async () => {
    // Mock build process failure
    mockChildProcess.on = jest.fn((event, callback) => {
      if (event === 'close') {
        callback(1); // Exit code 1 = failure
      }
    });
    
    // Verify function throws error
    await expect(dev({ path: '/path/to/function.js' }))
      .rejects.toThrow();
  });
});