import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Mock specifiers resolve relative to tests/setup/setupTests.js, not this file.
// See the note at the bottom of that file.
//
// dev.js uses default imports for fs and http and a named import for spawn and
// watchFile, so each mock has to provide both shapes.
const fsMock = {
  existsSync: jest.fn(),
  promises: { readFile: jest.fn() },
  watchFile: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(''),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unwatchFile: jest.fn()
};
jest.unstable_mockModule('fs', () => ({ __esModule: true, ...fsMock, default: fsMock }));

const httpMock = { createServer: jest.fn() };
jest.unstable_mockModule('http', () => ({ __esModule: true, ...httpMock, default: httpMock }));

const spawnMock = jest.fn();
jest.unstable_mockModule('child_process', () => ({
  __esModule: true,
  spawn: spawnMock,
  default: { spawn: spawnMock }
}));

const MiniflareMock = jest.fn();
jest.unstable_mockModule('miniflare', () => ({ __esModule: true, Miniflare: MiniflareMock }));

jest.unstable_mockModule('../../src/lib/config.js', () => ({
  __esModule: true,
  getApiConfig: jest.fn()
}));

const fs = (await import('fs')).default;
const http = (await import('http')).default;
const { spawn } = await import('child_process');
const { Miniflare } = await import('miniflare');
const { getApiConfig } = await import('../../../src/lib/config.js');
const { dev } = await import('../../../src/commands/dev.js');

describe('dev command', () => {
  const mockApiConfig = {
    apiUrl: 'https://test-api.glia.com',
    siteId: 'test-site-id',
    bearerToken: 'test-bearer-token'
  };

  let mockServer;
  let mockMiniflareInstance;
  let mockChildProcess;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue('// Function code');

    mockServer = {
      listen: jest.fn((port, callback) => callback()),
      close: jest.fn()
    };
    http.createServer.mockReturnValue(mockServer);

    mockMiniflareInstance = {
      dispatchFetch: jest.fn().mockResolvedValue({
        status: 200,
        headers: new Map([['Content-Type', 'application/json']]),
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('{"message":"ok"}'))
      }),
      getGlobalScope: jest.fn().mockResolvedValue({}),
      dispose: jest.fn()
    };
    Miniflare.mockImplementation(() => mockMiniflareInstance);

    mockChildProcess = {
      stdout: {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback(Buffer.from('Build completed'));
        })
      },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') callback(0);
      }),
      kill: jest.fn()
    };
    spawn.mockReturnValue(mockChildProcess);

    getApiConfig.mockResolvedValue(mockApiConfig);

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should bundle, boot Miniflare and serve on the requested port', async () => {
    const result = await dev({ path: '/path/to/function.js', port: 8787 });

    expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('function.js'));
    expect(spawn).toHaveBeenCalled();
    expect(Miniflare).toHaveBeenCalled();
    expect(http.createServer).toHaveBeenCalled();
    expect(mockServer.listen).toHaveBeenCalledWith(8787, expect.any(Function));

    expect(result).toEqual(expect.objectContaining({
      port: 8787,
      functionPath: expect.any(String)
    }));
  });

  it('should install a file watcher in watch mode', async () => {
    await dev({ path: '/path/to/function.js', port: 8788, watch: true });

    expect(fs.watchFile).toHaveBeenCalledWith(
      expect.stringContaining('function.js'),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should reject when the function file does not exist', async () => {
    fs.existsSync.mockReturnValue(false);

    await expect(dev({ path: '/nonexistent/path.js' }))
      .rejects.toThrow('Function file not found');
  });

  it('should reject when the bundle step fails', async () => {
    mockChildProcess.on = jest.fn((event, callback) => {
      if (event === 'close') callback(1);
    });

    await expect(dev({ path: '/path/to/function.js', port: 8789 })).rejects.toThrow();
  });
});
