/**
 * Request caching system for the Glia API client
 * 
 * Provides caching mechanisms for API requests to improve performance
 * and reduce unnecessary network traffic. Includes support for both
 * in-memory caching and persistent disk-based caching.
 */

import { PersistentCacheStorage } from './offline.js';

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG = {
  enabled: true,
  ttlMs: 60000, // 1 minute default TTL
  maxSize: 100, // Maximum number of cached entries
  methods: ['GET'], // Only cache GET requests by default
  persistent: false, // Whether to use persistent cache
  persistentPath: null, // Path for persistent cache (null = use default)
};

/**
 * Cache for API responses (in-memory with optional persistence)
 */
export class ResponseCache {
  /**
   * Create a new response cache
   * 
   * @param {Object} options - Cache configuration
   * @param {boolean} options.enabled - Whether caching is enabled
   * @param {number} options.ttlMs - Time-to-live for cache entries in milliseconds
   * @param {number} options.maxSize - Maximum number of cache entries
   * @param {string[]} options.methods - HTTP methods to cache
   * @param {boolean} options.persistent - Whether to use persistent cache
   * @param {string} options.persistentPath - Path for persistent cache
   */
  constructor(options = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...options };
    this.cache = new Map();
    this.keys = []; // For tracking LRU
    this.enabled = this.config.enabled;
    
    // Initialize persistent cache if enabled
    if (this.config.persistent) {
      this.persistentCache = new PersistentCacheStorage({
        cachePath: this.config.persistentPath
      });
      
      // Initialize persistent cache (async, but don't block constructor)
      this.persistentCache.init().catch(err => {
        console.error('Failed to initialize persistent cache:', err);
      });
    }
  }
  
  /**
   * Generate a cache key from request parameters
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {string} - Cache key
   */
  generateKey(endpoint, options = {}) {
    const method = options.method || 'GET';
    const body = options.body || '';
    
    // Use JSON.stringify for body, but handle non-JSON bodies
    const bodyStr = typeof body === 'string' 
      ? body 
      : JSON.stringify(body);
    
    // Create a unique key based on method + endpoint + body
    return `${method}:${endpoint}:${bodyStr}`;
  }
  
  /**
   * Check if a request is cacheable
   * 
   * @param {string} method - HTTP method
   * @returns {boolean} - Whether the request is cacheable
   */
  isCacheable(method) {
    return this.enabled && this.config.methods.includes(method || 'GET');
  }
  
  /**
   * Get a cached response
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Object|null} - Cached response or null if not found/expired
   */
  get(endpoint, options = {}) {
    if (!this.enabled) {
      return null;
    }
    
    const method = options.method || 'GET';
    
    if (!this.isCacheable(method)) {
      return null;
    }
    
    const key = this.generateKey(endpoint, options);
    const entry = this.cache.get(key);
    
    // No entry found
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (entry.expires <= Date.now()) {
      this.cache.delete(key);
      this.keys = this.keys.filter(k => k !== key);
      return null;
    }
    
    // Update LRU order - move this key to the end of the array
    this.keys = this.keys.filter(k => k !== key);
    this.keys.push(key);
    
    // Return a deep copy to prevent modification of cached data
    return JSON.parse(JSON.stringify(entry.data));
  }
  
  /**
   * Get a cached response asynchronously (checks both memory and persistent cache)
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object|null>} - Cached response or null if not found/expired
   */
  async getAsync(endpoint, options = {}) {
    if (!this.enabled) {
      return null;
    }
    
    const method = options.method || 'GET';
    
    if (!this.isCacheable(method)) {
      return null;
    }
    
    const key = this.generateKey(endpoint, options);
    
    // Check memory cache first (fastest)
    const memoryEntry = this.cache.get(key);
    if (memoryEntry) {
      // Check if entry has expired
      if (memoryEntry.expires <= Date.now()) {
        this.cache.delete(key);
        this.keys = this.keys.filter(k => k !== key);
      } else {
        // Update LRU order
        this.keys = this.keys.filter(k => k !== key);
        this.keys.push(key);
        
        // Return a deep copy
        return JSON.parse(JSON.stringify(memoryEntry.data));
      }
    }
    
    // If persistent cache is enabled, check it
    if (this.config.persistent && this.persistentCache) {
      try {
        const persistentEntry = await this.persistentCache.load(key);
        if (persistentEntry) {
          // Add to in-memory cache for faster future access
          this.cache.set(key, {
            data: persistentEntry.data,
            expires: persistentEntry.expires
          });
          
          // Update LRU order
          this.keys = this.keys.filter(k => k !== key);
          this.keys.push(key);
          
          // Enforce memory cache size limit
          this.enforceSizeLimit();
          
          return persistentEntry.data;
        }
      } catch (error) {
        console.error('Error loading from persistent cache:', error);
      }
    }
    
    return null;
  }
  
  /**
   * Store a response in the cache
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @param {Object} data - Response data
   * @param {number} ttlOverride - Optional TTL override in milliseconds
   */
  set(endpoint, options, data, ttlOverride) {
    if (!this.enabled) {
      return;
    }
    
    const method = options.method || 'GET';
    
    if (!this.isCacheable(method)) {
      return;
    }
    
    // Skip caching null or undefined responses
    if (data === null || data === undefined) {
      return;
    }
    
    const key = this.generateKey(endpoint, options);
    const ttl = ttlOverride || this.config.ttlMs;
    const expires = Date.now() + ttl;
    
    // Create a deep copy to prevent modification of cached data
    const dataCopy = JSON.parse(JSON.stringify(data));
    
    // Store entry in memory cache with expiration time
    this.cache.set(key, {
      data: dataCopy,
      expires
    });
    
    // Update LRU order
    this.keys = this.keys.filter(k => k !== key);
    this.keys.push(key);
    
    // Check if we need to evict entries (LRU policy)
    this.enforceSizeLimit();
    
    // Also store in persistent cache if enabled
    if (this.config.persistent && this.persistentCache) {
      this.persistentCache.save(key, {
        data: dataCopy,
        timestamp: Date.now(),
        expires
      }).catch(error => {
        console.error('Error saving to persistent cache:', error);
      });
    }
  }
  
  /**
   * Invalidate a specific cache entry
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   */
  invalidate(endpoint, options = {}) {
    if (!this.enabled) {
      return;
    }
    
    const key = this.generateKey(endpoint, options);
    
    // Remove from memory cache
    this.cache.delete(key);
    this.keys = this.keys.filter(k => k !== key);
    
    // Also remove from persistent cache if enabled
    if (this.config.persistent && this.persistentCache) {
      this.persistentCache.delete(key).catch(error => {
        console.error('Error invalidating persistent cache entry:', error);
      });
    }
  }
  
  /**
   * Invalidate all cache entries matching a pattern
   * 
   * @param {string|RegExp} pattern - Pattern to match against endpoint
   */
  invalidatePattern(pattern) {
    if (!this.enabled) {
      return;
    }
    
    const isRegExp = pattern instanceof RegExp;
    
    // Find all keys matching the pattern
    const keysToRemove = [];
    
    this.keys.forEach(key => {
      const parts = key.split(':');
      const endpoint = parts[1]; // endpoint is the second part after method
      
      if (isRegExp && pattern.test(endpoint)) {
        keysToRemove.push(key);
      } else if (typeof pattern === 'string' && endpoint.includes(pattern)) {
        keysToRemove.push(key);
      }
    });
    
    // Remove matched keys from memory cache
    keysToRemove.forEach(key => {
      this.cache.delete(key);
    });
    
    this.keys = this.keys.filter(key => !keysToRemove.includes(key));
    
    // Also clear from persistent cache if enabled
    if (this.config.persistent && this.persistentCache) {
      this.persistentCache.clearPattern(pattern).catch(error => {
        console.error('Error invalidating persistent cache pattern:', error);
      });
    }
  }
  
  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.keys = [];
  }
  
  /**
   * Enable or disable the cache
   * 
   * @param {boolean} enabled - Whether to enable the cache
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    
    // Clear cache when disabling
    if (!enabled) {
      this.clear();
    }
  }
  
  /**
   * Enforce the maximum cache size by removing least recently used entries
   */
  enforceSizeLimit() {
    while (this.keys.length > this.config.maxSize) {
      const oldest = this.keys.shift(); // Remove and get the oldest key
      this.cache.delete(oldest);
    }
  }
}
