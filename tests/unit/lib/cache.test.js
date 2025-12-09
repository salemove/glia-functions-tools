import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { 
  DEFAULT_CACHE_CONFIG,
  ResponseCache
} from '../../../src/lib/cache.js';

describe('Caching mechanism', () => {
  let cache;
  
  beforeEach(() => {
    // Reset cache before each test
    cache = new ResponseCache();
    
    // Mock Date.now to control time in tests
    jest.spyOn(Date, 'now').mockImplementation(() => 1000);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ResponseCache constructor', () => {
    it('should create a cache with default configuration', () => {
      expect(cache.config).toEqual(DEFAULT_CACHE_CONFIG);
      expect(cache.cache).toBeInstanceOf(Map);
      expect(cache.keys).toEqual([]);
      expect(cache.enabled).toBe(true);
    });
    
    it('should merge provided options with defaults', () => {
      const customCache = new ResponseCache({
        enabled: false,
        ttlMs: 30000,
      });
      
      expect(customCache.config.enabled).toBe(false);
      expect(customCache.config.ttlMs).toBe(30000);
      expect(customCache.config.maxSize).toBe(DEFAULT_CACHE_CONFIG.maxSize);
      expect(customCache.enabled).toBe(false);
    });
  });
  
  describe('generateKey', () => {
    it('should generate key with default GET method', () => {
      const key = cache.generateKey('/test');
      expect(key).toBe('GET:/test:');
    });
    
    it('should include method in the key', () => {
      const key = cache.generateKey('/test', { method: 'POST' });
      expect(key).toBe('POST:/test:');
    });
    
    it('should include string body in the key', () => {
      const key = cache.generateKey('/test', { 
        method: 'POST', 
        body: 'test-body' 
      });
      expect(key).toBe('POST:/test:test-body');
    });
    
    it('should stringify object bodies', () => {
      const body = { foo: 'bar' };
      const key = cache.generateKey('/test', { method: 'POST', body });
      expect(key).toBe(`POST:/test:${JSON.stringify(body)}`);
    });
  });
  
  describe('isCacheable', () => {
    it('should return true for GET requests when enabled', () => {
      expect(cache.isCacheable('GET')).toBe(true);
    });
    
    it('should return false for POST requests by default', () => {
      expect(cache.isCacheable('POST')).toBe(false);
    });
    
    it('should return false when cache is disabled', () => {
      cache.setEnabled(false);
      expect(cache.isCacheable('GET')).toBe(false);
    });
    
    it('should allow custom cacheable methods', () => {
      const customCache = new ResponseCache({
        methods: ['GET', 'HEAD']
      });
      
      expect(customCache.isCacheable('GET')).toBe(true);
      expect(customCache.isCacheable('HEAD')).toBe(true);
      expect(customCache.isCacheable('POST')).toBe(false);
    });
  });
  
  describe('get and set operations', () => {
    const endpoint = '/test';
    const options = { method: 'GET' };
    const data = { result: 'test-data' };
    
    it('should return null for non-existent cache entries', () => {
      expect(cache.get(endpoint, options)).toBeNull();
    });
    
    it('should store and retrieve data', () => {
      cache.set(endpoint, options, data);
      expect(cache.get(endpoint, options)).toEqual(data);
    });
    
    it('should return a deep copy of cached data', () => {
      const complexData = { result: { nested: { value: 42 } } };
      cache.set(endpoint, options, complexData);
      
      const retrieved = cache.get(endpoint, options);
      expect(retrieved).toEqual(complexData);
      
      // Modifying returned data should not affect cache
      retrieved.result.nested.value = 99;
      
      const retrievedAgain = cache.get(endpoint, options);
      expect(retrievedAgain.result.nested.value).toBe(42);
    });
    
    it('should not cache non-cacheable methods', () => {
      const postOptions = { method: 'POST' };
      cache.set(endpoint, postOptions, data);
      expect(cache.get(endpoint, postOptions)).toBeNull();
    });
    
    it('should not store null or undefined values', () => {
      cache.set(endpoint, options, null);
      cache.set(endpoint + '/undefined', options, undefined);
      
      expect(cache.get(endpoint, options)).toBeNull();
      expect(cache.get(endpoint + '/undefined', options)).toBeNull();
    });
    
    it('should respect TTL for cache entries', () => {
      cache.set(endpoint, options, data);
      
      // Advance time beyond TTL
      jest.spyOn(Date, 'now').mockImplementation(() => 1000 + DEFAULT_CACHE_CONFIG.ttlMs + 1);
      
      expect(cache.get(endpoint, options)).toBeNull();
    });
    
    it('should allow custom TTL for specific entries', () => {
      const customTtl = 5000; // 5 seconds
      
      cache.set(endpoint, options, data, customTtl);
      
      // Within custom TTL
      jest.spyOn(Date, 'now').mockImplementation(() => 1000 + 4000);
      expect(cache.get(endpoint, options)).toEqual(data);
      
      // Beyond custom TTL
      jest.spyOn(Date, 'now').mockImplementation(() => 1000 + 6000);
      expect(cache.get(endpoint, options)).toBeNull();
    });
  });
  
  describe('LRU behavior', () => {
    it('should track LRU order', () => {
      cache.set('/test1', {}, { data: 1 });
      cache.set('/test2', {}, { data: 2 });
      cache.set('/test3', {}, { data: 3 });
      
      // Access test1 to make it most recently used
      cache.get('/test1', {});
      
      // Keys should now be in order: test2, test3, test1
      expect(cache.keys).toEqual([
        'GET:/test2:',
        'GET:/test3:',
        'GET:/test1:'
      ]);
    });
    
    it('should evict least recently used entries when maxSize is reached', () => {
      const smallCache = new ResponseCache({ maxSize: 2 });
      
      smallCache.set('/test1', {}, { data: 1 });
      smallCache.set('/test2', {}, { data: 2 });
      smallCache.set('/test3', {}, { data: 3 });
      
      // test1 should have been evicted
      expect(smallCache.get('/test1', {})).toBeNull();
      expect(smallCache.get('/test2', {})).toEqual({ data: 2 });
      expect(smallCache.get('/test3', {})).toEqual({ data: 3 });
      
      // After getting test2 and test3, these should be the most recently used
      // The exact order is implementation-dependent, so we'll just check that both keys exist
      // and that there are only 2 entries (test1 was evicted)
      expect(smallCache.keys.length).toBe(2);
      expect(smallCache.keys.includes('GET:/test2:')).toBe(true);
      expect(smallCache.keys.includes('GET:/test3:')).toBe(true);
    });
  });
  
  describe('cache invalidation', () => {
    beforeEach(() => {
      cache.set('/users/1', {}, { id: 1, name: 'Alice' });
      cache.set('/users/2', {}, { id: 2, name: 'Bob' });
      cache.set('/posts/1', {}, { id: 1, title: 'Hello' });
    });
    
    it('should invalidate a specific entry', () => {
      cache.invalidate('/users/1');
      
      expect(cache.get('/users/1', {})).toBeNull();
      expect(cache.get('/users/2', {})).not.toBeNull();
      expect(cache.get('/posts/1', {})).not.toBeNull();
    });
    
    it('should invalidate entries matching a string pattern', () => {
      cache.invalidatePattern('/users');
      
      expect(cache.get('/users/1', {})).toBeNull();
      expect(cache.get('/users/2', {})).toBeNull();
      expect(cache.get('/posts/1', {})).not.toBeNull();
    });
    
    it('should invalidate entries matching a regex pattern', () => {
      cache.invalidatePattern(/\/users\/\d+/);
      
      expect(cache.get('/users/1', {})).toBeNull();
      expect(cache.get('/users/2', {})).toBeNull();
      expect(cache.get('/posts/1', {})).not.toBeNull();
    });
    
    it('should clear all cache entries', () => {
      cache.clear();
      
      expect(cache.get('/users/1', {})).toBeNull();
      expect(cache.get('/users/2', {})).toBeNull();
      expect(cache.get('/posts/1', {})).toBeNull();
      expect(cache.keys).toEqual([]);
    });
  });
  
  describe('enable/disable functionality', () => {
    beforeEach(() => {
      cache.set('/test', {}, { data: 'test' });
    });
    
    it('should disable caching when setEnabled(false) is called', () => {
      cache.setEnabled(false);
      
      expect(cache.enabled).toBe(false);
      expect(cache.get('/test', {})).toBeNull();
      
      // Should not store new entries when disabled
      cache.set('/new', {}, { data: 'new' });
      cache.setEnabled(true);
      expect(cache.get('/new', {})).toBeNull();
    });
    
    it('should clear cache when disabled', () => {
      expect(cache.get('/test', {})).not.toBeNull();
      
      cache.setEnabled(false);
      
      // Re-enable and check that previous data is gone
      cache.setEnabled(true);
      expect(cache.get('/test', {})).toBeNull();
    });
  });
});
