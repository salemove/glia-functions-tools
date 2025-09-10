/**
 * KV Store Function Tests
 * 
 * This file contains tests for the KV Store function implementation.
 * It uses the mock KV Store to test the function behavior.
 */

import { onInvoke, onHealthCheck } from '../function.js';
import { MockKvStoreFactory } from './kvstore-mock.js';

describe('KV Store Function', () => {
  let kvStoreFactory;
  
  beforeEach(() => {
    // Create a fresh KV store factory for each test
    kvStoreFactory = new MockKvStoreFactory();
    
    // Set default environment variables
    process.env.KV_NAMESPACE = 'test_namespace';
    process.env.DEBUG_MODE = 'true';
  });
  
  afterEach(() => {
    // Clean up environment variables after each test
    delete process.env.KV_NAMESPACE;
    delete process.env.DEBUG_MODE;
  });
  
  // Helper function to create a request object
  function createRequest(method, path, body = null) {
    const headers = new Headers();
    if (body) {
      headers.set('content-type', 'application/json');
    }
    
    return new Request(`https://example.com${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
  }
  
  describe('onHealthCheck', () => {
    test('should return healthy status when KV store is working', async () => {
      // Arrange
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const result = await onHealthCheck(env, kvStoreFactory);
      
      // Assert
      expect(result.status).toBe('healthy');
      expect(result.kvStoreCheck).toBe('ok');
    });
    
    test('should handle errors gracefully', async () => {
      // Arrange
      const env = { KV_NAMESPACE: 'test_namespace' };
      const mockFactory = {
        initializeKvStore: () => ({
          set: () => { throw new Error('Test error'); }
        })
      };
      
      // Act
      const result = await onHealthCheck(env, mockFactory);
      
      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBeDefined();
    });
  });
  
  describe('GET operations', () => {
    test('should return 404 when key does not exist', async () => {
      // Arrange
      const request = createRequest('GET', '/get?key=nonexistent');
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const response = await onInvoke(request, env, kvStoreFactory);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
    
    test('should retrieve a value when key exists', async () => {
      // Arrange
      const kvStore = kvStoreFactory.initializeKvStore('test_namespace');
      await kvStore.set({ key: 'test-key', value: 'test-value' });
      
      const request = createRequest('GET', '/get?key=test-key');
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const response = await onInvoke(request, env, kvStoreFactory);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.key).toBe('test-key');
      expect(data.value).toBe('test-value');
    });
    
    test('should list all values with list endpoint', async () => {
      // Arrange
      const kvStore = kvStoreFactory.initializeKvStore('test_namespace');
      await kvStore.set({ key: 'key1', value: 'value1' });
      await kvStore.set({ key: 'key2', value: 'value2' });
      
      const request = createRequest('GET', '/list');
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const response = await onInvoke(request, env, kvStoreFactory);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.items.length).toBe(2);
      expect(data.items.find(i => i.key === 'key1').value).toBe('value1');
      expect(data.items.find(i => i.key === 'key2').value).toBe('value2');
    });
    
    test('should filter list by prefix', async () => {
      // Arrange
      const kvStore = kvStoreFactory.initializeKvStore('test_namespace');
      await kvStore.set({ key: 'user1_name', value: 'Alice' });
      await kvStore.set({ key: 'user2_name', value: 'Bob' });
      await kvStore.set({ key: 'config_setting', value: 'value' });
      
      const request = createRequest('GET', '/list?prefix=user');
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const response = await onInvoke(request, env, kvStoreFactory);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.items.length).toBe(2);
      expect(data.items.some(i => i.key === 'user1_name')).toBe(true);
      expect(data.items.some(i => i.key === 'user2_name')).toBe(true);
      expect(data.items.some(i => i.key === 'config_setting')).toBe(false);
    });
  });
  
  describe('POST operations', () => {
    test('should set a value successfully', async () => {
      // Arrange
      const request = createRequest('POST', '/set', {
        key: 'test-key',
        value: 'test-value'
      });
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const response = await onInvoke(request, env, kvStoreFactory);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.key).toBe('test-key');
      expect(data.value).toBe('test-value');
      
      // Verify the value was actually set
      const kvStore = kvStoreFactory.initializeKvStore('test_namespace');
      const result = await kvStore.get('test-key');
      expect(result.value).toBe('test-value');
    });
    
    test('should handle test-and-set when condition is met', async () => {
      // Arrange
      const kvStore = kvStoreFactory.initializeKvStore('test_namespace');
      await kvStore.set({ key: 'test-key', value: 'old-value' });
      
      const request = createRequest('POST', '/test-and-set', {
        key: 'test-key',
        oldValue: 'old-value',
        newValue: 'new-value'
      });
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const response = await onInvoke(request, env, kvStoreFactory);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.conditionMet).toBe(true);
      expect(data.key).toBe('test-key');
      expect(data.value).toBe('new-value');
      
      // Verify the value was actually updated
      const result = await kvStore.get('test-key');
      expect(result.value).toBe('new-value');
    });
    
    test('should handle test-and-set when condition is not met', async () => {
      // Arrange
      const kvStore = kvStoreFactory.initializeKvStore('test_namespace');
      await kvStore.set({ key: 'test-key', value: 'actual-value' });
      
      const request = createRequest('POST', '/test-and-set', {
        key: 'test-key',
        oldValue: 'wrong-value',
        newValue: 'new-value'
      });
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const response = await onInvoke(request, env, kvStoreFactory);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.conditionMet).toBe(false);
      
      // Verify the value was not updated
      const result = await kvStore.get('test-key');
      expect(result.value).toBe('actual-value');
    });
    
    test('should process batch operations', async () => {
      // Arrange
      const kvStore = kvStoreFactory.initializeKvStore('test_namespace');
      await kvStore.set({ key: 'existing-key', value: 'existing-value' });
      
      const request = createRequest('POST', '/batch', {
        operations: [
          { op: 'set', key: 'key1', value: 'value1' },
          { op: 'get', key: 'existing-key' },
          { op: 'get', key: 'nonexistent-key' },
          { op: 'test-and-set', key: 'existing-key', oldValue: 'existing-value', newValue: 'updated-value' }
        ]
      });
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const response = await onInvoke(request, env, kvStoreFactory);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.length).toBe(4);
      
      // Check set operation
      expect(data.results[0].key).toBe('key1');
      expect(data.results[0].value).toBe('value1');
      
      // Check get existing key operation
      expect(data.results[1].key).toBe('existing-key');
      expect(data.results[1].value).toBe('existing-value');
      
      // Check get nonexistent key operation
      expect(data.results[2]).toBeNull();
      
      // Check test-and-set operation
      expect(data.results[3].key).toBe('existing-key');
      expect(data.results[3].value).toBe('updated-value');
      
      // Verify values were actually updated
      const updatedKeyResult = await kvStore.get('existing-key');
      expect(updatedKeyResult.value).toBe('updated-value');
    });
  });
  
  describe('DELETE operations', () => {
    test('should delete a value successfully', async () => {
      // Arrange
      const kvStore = kvStoreFactory.initializeKvStore('test_namespace');
      await kvStore.set({ key: 'delete-key', value: 'delete-value' });
      
      const request = createRequest('DELETE', '/delete?key=delete-key');
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const response = await onInvoke(request, env, kvStoreFactory);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.key).toBe('delete-key');
      expect(data.deleted).toBe(true);
      
      // Verify the value was actually deleted
      const result = await kvStore.get('delete-key');
      expect(result).toBeNull();
    });
  });
  
  describe('Error handling', () => {
    test('should handle method not allowed', async () => {
      // Arrange
      const request = createRequest('PUT', '/invalid');
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const response = await onInvoke(request, env, kvStoreFactory);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
      expect(response.headers.get('Allow')).toBe('GET, POST, DELETE, OPTIONS');
    });
    
    test('should handle missing key in set operation', async () => {
      // Arrange
      const request = createRequest('POST', '/set', {
        value: 'missing-key-value'
      });
      const env = { KV_NAMESPACE: 'test_namespace' };
      
      // Act
      const response = await onInvoke(request, env, kvStoreFactory);
      const data = await response.json();
      
      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing key parameter');
    });
  });
});