/**
 * Tests for the offline support functionality
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import {
  DEFAULT_OFFLINE_CONFIG,
  OperationQueue,
  PersistentCacheStorage,
  NetworkDetector,
  OfflineManager,
} from '../../../src/lib/offline';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  access: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();
global.AbortController = jest.fn(() => ({
  abort: jest.fn(),
  signal: 'mock-signal',
}));

// Mock setTimeout and clearTimeout
jest.spyOn(global, 'setTimeout').mockImplementation(() => 123);
jest.spyOn(global, 'clearTimeout').mockImplementation(() => {});

// Helper to create a temp test directory
const createTempDir = () => {
  const tmpDir = path.join(os.tmpdir(), `glia-test-${Date.now()}`);
  return tmpDir;
};

describe('OperationQueue', () => {
  let queue;
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
    queue = new OperationQueue({ queuePath: tempDir });
    jest.clearAllMocks();
  });

  test('init creates the queue directory', async () => {
    await queue.init();
    expect(fs.mkdir).toHaveBeenCalledWith(tempDir, { recursive: true });
  });

  test('add inserts an operation into the queue', async () => {
    const operation = { endpoint: '/test', method: 'GET' };
    fs.readdir.mockResolvedValue([]);

    const id = await queue.add(operation);
    
    expect(id).toMatch(/^\d+-[a-z0-9]+$/); // Check ID format
    expect(fs.writeFile).toHaveBeenCalled();
    
    // Check the operation was saved correctly
    const writeCall = fs.writeFile.mock.calls[0];
    const filePath = writeCall[0];
    const fileContent = JSON.parse(writeCall[1]);
    
    expect(filePath).toMatch(new RegExp(`${tempDir}/.*\\.json$`));
    expect(fileContent).toEqual({
      id: expect.any(String),
      timestamp: expect.any(Number),
      operation
    });
  });

  test('add throws when queue is full', async () => {
    const operations = Array(DEFAULT_OFFLINE_CONFIG.maxQueueSize).fill(null)
      .map((_, i) => ({ 
        id: `test-${i}`,
        timestamp: Date.now() + i,
        operation: { endpoint: `/test-${i}` }
      }));
      
    fs.readdir.mockResolvedValue(operations.map((op) => `${op.id}.json`));
    operations.forEach((op) => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify(op));
    });
    
    await expect(queue.add({ endpoint: '/new-test' })).rejects.toThrow(/maximum size/);
  });

  test('getPendingOperations retrieves and sorts operations', async () => {
    const files = ['op1.json', 'op2.json', 'op3.json'];
    const ops = [
      { id: 'op3', timestamp: 300, operation: { endpoint: '/test3' } },
      { id: 'op1', timestamp: 100, operation: { endpoint: '/test1' } },
      { id: 'op2', timestamp: 200, operation: { endpoint: '/test2' } },
    ];
    
    fs.readdir.mockResolvedValue(files);
    ops.forEach((op) => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify(op));
    });
    
    const result = await queue.getPendingOperations();
    
    // Should be sorted by timestamp
    expect(result).toEqual([
      ops[1], // timestamp 100
      ops[2], // timestamp 200
      ops[0], // timestamp 300
    ]);
  });

  test('remove deletes an operation from the queue', async () => {
    const id = 'test-op-id';
    await queue.remove(id);
    
    expect(fs.unlink).toHaveBeenCalledWith(path.join(tempDir, `${id}.json`));
  });

  test('clear removes all operations', async () => {
    const ops = [
      { id: 'op1', timestamp: 100, operation: { endpoint: '/test1' } },
      { id: 'op2', timestamp: 200, operation: { endpoint: '/test2' } },
    ];
    
    fs.readdir.mockResolvedValue(['op1.json', 'op2.json']);
    ops.forEach((op) => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify(op));
    });
    
    const result = await queue.clear();
    
    expect(result).toBe(2); // Cleared 2 operations
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.unlink).toHaveBeenCalledWith(path.join(tempDir, 'op1.json'));
    expect(fs.unlink).toHaveBeenCalledWith(path.join(tempDir, 'op2.json'));
  });
});

describe('PersistentCacheStorage', () => {
  let cache;
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
    cache = new PersistentCacheStorage({ cachePath: tempDir });
    jest.clearAllMocks();
  });

  test('init creates the cache directory', async () => {
    await cache.init();
    expect(fs.mkdir).toHaveBeenCalledWith(tempDir, { recursive: true });
  });

  test('save stores data with metadata', async () => {
    const key = 'test-key';
    const data = { data: { value: 42 }, expires: Date.now() + 10000 };
    
    await cache.save(key, data);
    
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    
    // Check the data was saved correctly
    const writeCall = fs.writeFile.mock.calls[0];
    const filePath = writeCall[0];
    const fileContent = JSON.parse(writeCall[1]);
    
    expect(filePath).toMatch(new RegExp(`${tempDir}/.*\\.json$`));
    expect(fileContent).toMatchObject({
      key,
      data: { value: 42 },
      expires: expect.any(Number),
      savedAt: expect.any(Number)
    });
  });

  test('load retrieves cached data', async () => {
    const key = 'test-key';
    const cachedData = {
      key,
      data: { value: 42 },
      expires: Date.now() + 10000,
      savedAt: Date.now()
    };
    
    fs.readFile.mockResolvedValue(JSON.stringify(cachedData));
    
    const result = await cache.load(key);
    
    expect(result).toEqual(cachedData);
  });

  test('load returns null for expired data', async () => {
    const key = 'test-key';
    const cachedData = {
      key,
      data: { value: 42 },
      expires: Date.now() - 1000, // Expired
      savedAt: Date.now() - 2000
    };
    
    fs.readFile.mockResolvedValue(JSON.stringify(cachedData));
    
    const result = await cache.load(key);
    
    expect(result).toBeNull();
    expect(fs.unlink).toHaveBeenCalled(); // Should delete expired entry
  });

  test('load returns null when file does not exist', async () => {
    fs.access.mockRejectedValue(new Error('File not found'));
    
    const result = await cache.load('nonexistent-key');
    
    expect(result).toBeNull();
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  test('delete removes a cache entry', async () => {
    const key = 'test-key';
    
    await cache.delete(key);
    
    expect(fs.unlink).toHaveBeenCalled();
  });

  test('clear removes all cache entries', async () => {
    fs.readdir.mockResolvedValue(['file1.json', 'file2.json', 'not-json.txt']);
    
    const result = await cache.clear();
    
    expect(result).toBe(2); // Only JSON files are cleared
    expect(fs.unlink).toHaveBeenCalledTimes(2);
  });

  test('clearPattern removes matching entries', async () => {
    const files = ['key1.json', 'key2.json', 'key3.json'];
    const entries = [
      { key: '/api/functions/123', data: {} },
      { key: '/api/versions/456', data: {} },
      { key: '/api/functions/789', data: {} }
    ];
    
    fs.readdir.mockResolvedValue(files);
    
    entries.forEach((entry, i) => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify(entry));
    });
    
    const result = await cache.clearPattern('/api/functions');
    
    expect(result).toBe(2); // 2 entries match the pattern
    expect(fs.unlink).toHaveBeenCalledTimes(2);
  });
});

describe('NetworkDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new NetworkDetector({
      checkInterval: 1000,
      checkUrl: 'https://test.example.com'
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    detector.stopChecking();
  });

  test('checkNow detects online status', async () => {
    global.fetch.mockResolvedValue({ ok: true });
    
    const result = await detector.checkNow();
    
    expect(result).toBe(false); // false means online
    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.example.com',
      expect.objectContaining({
        method: 'HEAD',
        cache: 'no-cache',
        signal: 'mock-signal'
      })
    );
  });

  test('checkNow detects offline status on fetch error', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    
    const result = await detector.checkNow();
    
    expect(result).toBe(true); // true means offline
  });

  test('checkNow detects offline status on non-OK response', async () => {
    global.fetch.mockResolvedValue({ ok: false });
    
    const result = await detector.checkNow();
    
    expect(result).toBe(true); // true means offline
  });

  test('startChecking sets up periodic checks and calls callback on status change', async () => {
    const onStatusChange = jest.fn();
    
    // Initially online
    global.fetch.mockResolvedValueOnce({ ok: true });
    detector.startChecking(onStatusChange);
    
    // Wait for initial check
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Now offline
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    
    // Trigger a check manually (to avoid waiting for the interval)
    await detector._checkConnection();
    
    expect(onStatusChange).toHaveBeenCalledWith(true); // Called with 'offline: true'
  });
});

describe('OfflineManager', () => {
  let manager;
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
    manager = new OfflineManager({
      enabled: true,
      requestQueuePath: path.join(tempDir, 'queue'),
      cachePath: path.join(tempDir, 'cache'),
      networkCheckUrl: 'https://test.example.com'
    });
    
    // Mock the internal components
    manager.operationQueue = {
      init: jest.fn(),
      add: jest.fn().mockResolvedValue('test-id'),
      getPendingOperations: jest.fn(),
      remove: jest.fn()
    };
    
    manager.networkDetector = {
      startChecking: jest.fn(),
      checkNow: jest.fn(),
      stopChecking: jest.fn()
    };
    
    jest.clearAllMocks();
  });

  test('init initializes queue and starts network checking', async () => {
    await manager.init();
    
    expect(manager.operationQueue.init).toHaveBeenCalled();
    expect(manager.networkDetector.startChecking).toHaveBeenCalled();
  });

  test('isOffline returns network status', async () => {
    manager.networkDetector.checkNow.mockResolvedValue(true); // Offline
    
    const result = await manager.isOffline();
    
    expect(result).toBe(true);
    expect(manager.networkDetector.checkNow).toHaveBeenCalled();
  });
  
  test('setExecuteFunction stores reference to API execution function', () => {
    const executeFn = jest.fn();
    
    manager.setExecuteFunction(executeFn);
    
    expect(manager.executeFunction).toBe(executeFn);
  });
  
  test('saveToCache initializes and uses persistentCache', async () => {
    // Create a test PersistentCacheStorage mock
    const mockPersistentCache = {
      init: jest.fn().mockResolvedValue(),
      save: jest.fn().mockResolvedValue()
    };
    
    // Replace the constructor to return our mock
    const originalPersistentCache = global.PersistentCacheStorage;
    global.PersistentCacheStorage = jest.fn(() => mockPersistentCache);
    
    const endpoint = '/test-endpoint';
    const options = { method: 'GET' };
    const data = { test: 'data' };
    const ttl = 60000;
    
    await manager.saveToCache(endpoint, options, data, ttl);
    
    // Check that persistentCache was initialized
    expect(mockPersistentCache.init).toHaveBeenCalled();
    
    // Check that save was called with correct params
    expect(mockPersistentCache.save).toHaveBeenCalledWith(
      expect.any(String), // Cache key
      expect.objectContaining({
        data,
        expires: expect.any(Number),
        endpoint,
        method: 'GET'
      })
    );
    
    // Restore original
    global.PersistentCacheStorage = originalPersistentCache;
  });

  test('executeOrQueue executes function when online', async () => {
    const executeFunction = jest.fn().mockResolvedValue({ success: true });
    manager.networkDetector.checkNow.mockResolvedValue(false); // Online
    
    const result = await manager.executeOrQueue(executeFunction, { test: true });
    
    expect(result).toEqual({ success: true });
    expect(executeFunction).toHaveBeenCalled();
    expect(manager.operationQueue.add).not.toHaveBeenCalled();
  });

  test('executeOrQueue queues operation when offline', async () => {
    const executeFunction = jest.fn().mockResolvedValue({ success: true });
    manager.networkDetector.checkNow.mockResolvedValue(true); // Offline
    
    const result = await manager.executeOrQueue(executeFunction, { test: true });
    
    expect(result).toMatchObject({
      _offlinePlaceholder: true,
      queuedAt: expect.any(Number),
      operation: { test: true }
    });
    expect(executeFunction).not.toHaveBeenCalled();
    expect(manager.operationQueue.add).toHaveBeenCalledWith({ test: true });
  });

  test('processQueue processes all pending operations', async () => {
    // Mock as online
    manager.networkDetector.checkNow.mockResolvedValue(false);
    
    // Setup pending operations
    const pendingOps = [
      { id: 'op1', operation: { endpoint: '/test1' } },
      { id: 'op2', operation: { endpoint: '/test2' } }
    ];
    manager.operationQueue.getPendingOperations.mockResolvedValue(pendingOps);
    
    // Process function mock
    const processFunction = jest.fn()
      .mockResolvedValueOnce({ success: true, data: 'result1' })
      .mockResolvedValueOnce({ success: true, data: 'result2' });
    
    const results = await manager.processQueue(processFunction);
    
    expect(results).toEqual([
      { id: 'op1', result: { success: true, data: 'result1' }, success: true },
      { id: 'op2', result: { success: true, data: 'result2' }, success: true }
    ]);
    
    expect(processFunction).toHaveBeenCalledTimes(2);
    expect(manager.operationQueue.remove).toHaveBeenCalledTimes(2);
  });

  test('processQueue handles operation failures', async () => {
    // Mock as online
    manager.networkDetector.checkNow.mockResolvedValue(false);
    
    // Setup pending operations
    const pendingOps = [
      { id: 'op1', operation: { endpoint: '/test1' } },
      { id: 'op2', operation: { endpoint: '/test2' } }
    ];
    manager.operationQueue.getPendingOperations.mockResolvedValue(pendingOps);
    
    // Process function mock - first succeeds, second fails
    const processFunction = jest.fn()
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('Operation failed'));
    
    const results = await manager.processQueue(processFunction);
    
    expect(results).toEqual([
      { id: 'op1', result: { success: true }, success: true },
      { id: 'op2', error: 'Operation failed', success: false }
    ]);
    
    // Only successful operations should be removed
    expect(manager.operationQueue.remove).toHaveBeenCalledTimes(1);
    expect(manager.operationQueue.remove).toHaveBeenCalledWith('op1');
  });

  test('processQueue throws when offline', async () => {
    // Mock as offline
    manager.networkDetector.checkNow.mockResolvedValue(true);
    
    await expect(manager.processQueue(() => {})).rejects.toThrow('Cannot process queue while offline');
  });

  test('setEnabled updates enabled status and handles network detector', () => {
    manager.setEnabled(false);
    
    expect(manager.enabled).toBe(false);
    expect(manager.networkDetector.stopChecking).toHaveBeenCalled();
    
    manager.setEnabled(true);
    
    expect(manager.enabled).toBe(true);
    expect(manager.networkDetector.startChecking).toHaveBeenCalled();
  });
});
