/**
 * Offline support for the Glia API client
 * 
 * Provides offline capabilities including network detection,
 * operation queueing, and persistent cache management.
 */

import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

/**
 * Default offline configuration
 */
export const DEFAULT_OFFLINE_CONFIG = {
  enabled: true,
  requestQueuePath: path.join(homedir(), '.glia-cli', 'offline-queue'),
  cachePath: path.join(homedir(), '.glia-cli', 'offline-cache'),
  networkCheckUrl: 'https://api.glia.com',
  networkCheckInterval: 30000, // 30 seconds
  maxQueueSize: 100,
  retryStrategy: 'exponential'
};

/**
 * Operation queue for storing API operations when offline
 */
export class OperationQueue {
  /**
   * Create a new operation queue
   * 
   * @param {Object} options - Queue configuration
   * @param {string} options.queuePath - Path to store queue data
   * @param {number} options.maxSize - Maximum queue size
   */
  constructor(options = {}) {
    this.queuePath = options.queuePath || DEFAULT_OFFLINE_CONFIG.requestQueuePath;
    this.maxSize = options.maxSize || DEFAULT_OFFLINE_CONFIG.maxQueueSize;
  }

  /**
   * Initialize the queue storage
   * 
   * @returns {Promise<void>}
   */
  async init() {
    try {
      await fs.mkdir(this.queuePath, { recursive: true });
    } catch (error) {
      console.error('Failed to create queue directory:', error);
      throw error;
    }
  }

  /**
   * Add an operation to the queue
   * 
   * @param {Object} operation - Operation to queue
   * @returns {Promise<string>} - Operation ID
   */
  async add(operation) {
    try {
      // Check if queue has reached max size
      const operations = await this.getPendingOperations();
      if (operations.length >= this.maxSize) {
        throw new Error(`Operation queue has reached maximum size (${this.maxSize})`);
      }
      
      // Generate a unique ID for the operation based on timestamp and a random value
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const id = `${timestamp}-${randomId}`;
      
      // Add timestamp and ID to operation
      const queuedOperation = {
        id,
        timestamp,
        operation
      };
      
      // Write operation to file
      const filePath = path.join(this.queuePath, `${id}.json`);
      await fs.writeFile(filePath, JSON.stringify(queuedOperation), 'utf8');
      
      return id;
    } catch (error) {
      console.error('Failed to add operation to queue:', error);
      throw error;
    }
  }

  /**
   * Get all pending operations from the queue
   * 
   * @returns {Promise<Array>} - Queued operations
   */
  async getPendingOperations() {
    try {
      // Get list of files in queue directory
      const files = await fs.readdir(this.queuePath);
      
      // Filter for JSON files
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      // Read and parse each file
      const operations = await Promise.all(jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(this.queuePath, file);
          const content = await fs.readFile(filePath, 'utf8');
          return JSON.parse(content);
        } catch (error) {
          console.error(`Failed to read queue file ${file}:`, error);
          return null;
        }
      }));
      
      // Filter out null values and sort by timestamp (oldest first)
      return operations
        .filter(op => op !== null)
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Failed to get pending operations:', error);
      return [];
    }
  }

  /**
   * Remove an operation from the queue
   * 
   * @param {string} id - Operation ID
   * @returns {Promise<boolean>} - Whether the operation was removed
   */
  async remove(id) {
    try {
      const filePath = path.join(this.queuePath, `${id}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error(`Failed to remove operation ${id}:`, error);
      return false;
    }
  }

  /**
   * Clear all operations from the queue
   * 
   * @returns {Promise<number>} - Number of operations cleared
   */
  async clear() {
    try {
      const operations = await this.getPendingOperations();
      await Promise.all(operations.map(op => this.remove(op.id)));
      return operations.length;
    } catch (error) {
      console.error('Failed to clear operation queue:', error);
      throw error;
    }
  }
}

/**
 * Persistent cache storage for offline data
 */
export class PersistentCacheStorage {
  /**
   * Create a new persistent cache storage
   * 
   * @param {Object} options - Cache configuration
   * @param {string} options.cachePath - Path to store cache data
   */
  constructor(options = {}) {
    this.cachePath = options.cachePath || DEFAULT_OFFLINE_CONFIG.cachePath;
  }

  /**
   * Initialize the cache storage
   * 
   * @returns {Promise<void>}
   */
  async init() {
    try {
      await fs.mkdir(this.cachePath, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
      throw error;
    }
  }

  /**
   * Generate a safe filename for a cache key
   * 
   * @param {string} key - Cache key
   * @returns {string} - Safe filename
   * @private
   */
  _keyToFilename(key) {
    // Convert key to a safe filename using base64 encoding
    const safeKey = Buffer.from(key).toString('base64')
      .replace(/\//g, '_')
      .replace(/\+/g, '-')
      .replace(/=/g, '');
    
    return `${safeKey}.json`;
  }

  /**
   * Save data to the persistent cache
   * 
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache (including "data" field and "expires" timestamp)
   * @returns {Promise<void>}
   */
  async save(key, data) {
    try {
      const filename = this._keyToFilename(key);
      const filePath = path.join(this.cachePath, filename);
      
      // Add metadata to the cached data
      const dataToSave = {
        key,
        ...data,
        savedAt: Date.now()
      };
      
      await fs.writeFile(filePath, JSON.stringify(dataToSave), 'utf8');
    } catch (error) {
      console.error(`Failed to save data for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Load data from the persistent cache
   * 
   * @param {string} key - Cache key
   * @returns {Promise<Object|null>} - Cached data or null if not found
   */
  async load(key) {
    try {
      const filename = this._keyToFilename(key);
      const filePath = path.join(this.cachePath, filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        // File not found
        return null;
      }
      
      // Read and parse file
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Check if data has expired
      if (data.expires && data.expires <= Date.now()) {
        // Delete expired entry
        await this.delete(key);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error(`Failed to load data for key "${key}":`, error);
      return null;
    }
  }

  /**
   * Delete an entry from the persistent cache
   * 
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Whether the entry was deleted
   */
  async delete(key) {
    try {
      const filename = this._keyToFilename(key);
      const filePath = path.join(this.cachePath, filename);
      
      try {
        await fs.unlink(filePath);
        return true;
      } catch (error) {
        // File not found or unable to delete
        return false;
      }
    } catch (error) {
      console.error(`Failed to delete data for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Clear all entries from the persistent cache
   * 
   * @returns {Promise<number>} - Number of entries cleared
   */
  async clear() {
    try {
      const files = await fs.readdir(this.cachePath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      await Promise.all(jsonFiles.map(async (file) => {
        try {
          await fs.unlink(path.join(this.cachePath, file));
        } catch (error) {
          console.error(`Failed to delete cache file ${file}:`, error);
        }
      }));
      
      return jsonFiles.length;
    } catch (error) {
      console.error('Failed to clear persistent cache:', error);
      return 0;
    }
  }

  /**
   * Clear all entries matching a pattern from persistent cache
   * 
   * @param {string|RegExp} pattern - Pattern to match against cache keys
   * @returns {Promise<number>} - Number of entries cleared
   */
  async clearPattern(pattern) {
    try {
      const files = await fs.readdir(this.cachePath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      let clearCount = 0;
      
      await Promise.all(jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(this.cachePath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(content);
          
          // Normalize pattern types
          const isRegExp = pattern instanceof RegExp;
          const key = data.key;
          
          // Check if key matches pattern
          if ((isRegExp && pattern.test(key)) ||
              (typeof pattern === 'string' && key.includes(pattern))) {
            await fs.unlink(filePath);
            clearCount++;
          }
        } catch (error) {
          console.error(`Failed to process cache file ${file}:`, error);
        }
      }));
      
      return clearCount;
    } catch (error) {
      console.error('Failed to clear persistent cache with pattern:', error);
      return 0;
    }
  }
}

/**
 * Network connectivity detector
 */
export class NetworkDetector {
  /**
   * Create a new network detector
   * 
   * @param {Object} options - Network detector configuration
   * @param {string} options.checkUrl - URL to check for connectivity
   * @param {number} options.checkInterval - Interval between checks in milliseconds
   */
  constructor(options = {}) {
    this.checkUrl = options.checkUrl || DEFAULT_OFFLINE_CONFIG.networkCheckUrl;
    this.checkInterval = options.checkInterval || DEFAULT_OFFLINE_CONFIG.networkCheckInterval;
    this.isOffline = false;
    this.checkIntervalId = null;
    this.onStatusChange = null;
  }

  /**
   * Start periodic network checks
   * 
   * @param {Function} onStatusChange - Callback for status changes
   */
  startChecking(onStatusChange) {
    this.onStatusChange = onStatusChange;
    
    // Perform initial check
    this._checkConnection();
    
    // Set up periodic checks
    this.checkIntervalId = setInterval(() => {
      this._checkConnection();
    }, this.checkInterval);
  }

  /**
   * Stop periodic network checks
   */
  stopChecking() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  /**
   * Check current connection status
   * 
   * @returns {Promise<boolean>} - Whether the client is offline
   */
  async checkNow() {
    return await this._checkConnection(true);
  }

  /**
   * Internal method to check connection
   * 
   * @param {boolean} returnResult - Whether to return the result
   * @returns {Promise<boolean>} - Whether the client is offline
   * @private
   */
  async _checkConnection(returnResult = false) {
    try {
      // Try multiple approaches for more reliable detection
      
      // 1. Check if navigator.onLine is available (browser environments)
      if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
        if (navigator.onLine === false) {
          // Browser reports definitely offline
          this._updateOfflineStatus(true, returnResult);
          return this.isOffline;
        }
        // Note: navigator.onLine=true doesn't guarantee connectivity,
        // so we continue with the network request check
      }
      
      // 2. Try to fetch the check URL with a short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Shorter timeout (3s)
      
      try {
        const response = await fetch(this.checkUrl, {
          method: 'HEAD', // HEAD request is lightweight
          cache: 'no-store', // Always bypass cache
          signal: controller.signal,
          // Additional options for reliability
          credentials: 'omit', // Don't send cookies
          redirect: 'manual', // Don't follow redirects
          referrerPolicy: 'no-referrer' // Don't send referrer
        });
        
        clearTimeout(timeoutId);
        
        // Connection is online if we got any response (even non-200)
        // This is more lenient than before - any response means network works
        this._updateOfflineStatus(false, returnResult);
        return this.isOffline;
      } catch (fetchError) {
        // The fetch failed - this could be a network issue
        // But let's add a secondary check before deciding we're offline
        
        // 3. Try a different endpoint as backup
        try {
          const backupResponse = await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD',
            cache: 'no-store',
            // Short timeout for backup check
            signal: AbortSignal.timeout(2000)
          });
          
          // If backup check worked, we're online
          this._updateOfflineStatus(false, returnResult);
          return this.isOffline;
        } catch (backupError) {
          // Both checks failed - very likely offline
          this._updateOfflineStatus(true, returnResult);
          return this.isOffline;
        }
      }
    } catch (error) {
      // Unexpected error in the overall connection check process
      // Log but don't automatically assume offline
      console.error('Error checking network connectivity:', error);
      
      // Only set to offline if we get clear network-related errors
      const isNetworkError = error.name === 'AbortError' || 
                             error.message.includes('network') ||
                             error.message.includes('connect');
      
      this._updateOfflineStatus(isNetworkError, returnResult);
      return this.isOffline;
    }
  }
  
  /**
   * Update offline status and trigger callback if needed
   * 
   * @param {boolean} offline - New offline status
   * @param {boolean} returnResult - Whether this is a query that needs a return value
   * @private 
   */
  _updateOfflineStatus(offline, returnResult) {
    const wasOffline = this.isOffline;
    this.isOffline = offline;
    
    // Log status changes
    if (wasOffline !== this.isOffline) {
      console.log(`[Network] Status changed: ${this.isOffline ? 'offline' : 'online'}`);
      
      // Notify callback if registered
      if (this.onStatusChange) {
        this.onStatusChange(this.isOffline);
      }
    }
    
    return offline;
  }
}

/**
 * Offline manager for handling offline operations
 */
export class OfflineManager {
  /**
   * Create a new offline manager
   * 
   * @param {Object} options - Offline manager configuration
   */
  constructor(options = {}) {
    this.config = { ...DEFAULT_OFFLINE_CONFIG, ...options };
    this.enabled = this.config.enabled;
    
    if (this.enabled) {
      // Initialize operation queue
      this.operationQueue = new OperationQueue({
        queuePath: this.config.requestQueuePath,
        maxSize: this.config.maxQueueSize
      });
      
      // Initialize network detector
      this.networkDetector = new NetworkDetector({
        checkUrl: this.config.networkCheckUrl,
        checkInterval: this.config.networkCheckInterval
      });
    }
  }

  /**
   * Initialize the offline manager
   * 
   * @returns {Promise<void>}
   */
  async init() {
    if (!this.enabled) {
      return;
    }
    
    try {
      // Initialize operation queue
      await this.operationQueue.init();
      
      // Perform an initial network check to set the correct initial state
      // But don't assume offline if this check fails (give benefit of doubt)
      try {
        const initialStatus = await this.networkDetector.checkNow();
        console.log(`[Offline] Initial network status: ${initialStatus ? 'offline' : 'online'}`);
      } catch (checkError) {
        console.warn('[Offline] Initial network check failed, assuming online:', checkError.message);
        // Force online status initially - better to start with optimistic assumption
        this.networkDetector.isOffline = false;
      }
      
      // Start periodic network checking with improved status change handling
      this.networkDetector.startChecking((isOffline) => {
        // Handle network status changes
        console.log(`[Offline] Network status changed: ${isOffline ? 'offline' : 'online'}`);
        
        // Auto-process queue when coming back online
        if (!isOffline) {
          console.log('[Offline] Network is back online, processing queued operations');
          this.processQueue((operation) => {
            // Extract operation details
            const { endpoint, options, requestOptions } = operation;
            
            // Execute the operation with offline mode disabled
            return this.executeFunction(endpoint, options, { 
              ...requestOptions, 
              offlineMode: false 
            });
          }).catch(err => {
            console.error('[Offline] Error processing queued operations:', err);
          });
        }
      });
    } catch (error) {
      console.error('[Offline] Failed to initialize offline manager:', error);
      // Don't throw the error - better to continue in online-only mode
      this.enabled = false;
    }
  }

  /**
   * Check if the client is currently offline
   * 
   * @returns {Promise<boolean>} - Whether the client is offline
   */
  async isOffline() {
    if (!this.enabled || !this.networkDetector) {
      return false;
    }
    
    return await this.networkDetector.checkNow();
  }

  /**
   * Enable or disable offline mode
   * 
   * @param {boolean} enabled - Whether to enable offline mode
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    
    if (!enabled && this.networkDetector) {
      // Stop network checking when disabled
      this.networkDetector.stopChecking();
    } else if (enabled && this.networkDetector) {
      // Restart network checking when enabled
      this.networkDetector.startChecking();
    }
  }

  /**
   * Execute an operation or queue it if offline
   * 
   * @param {Function} executeFunction - Function to execute when online
   * @param {Object} operation - Operation details for queueing
   * @returns {Promise<any>} - Operation result or placeholder
   */
  async executeOrQueue(executeFunction, operation) {
    if (!this.enabled) {
      // If offline mode is disabled, just execute the function
      return executeFunction();
    }
    
    // Check if we're offline
    const isOffline = await this.isOffline();
    
    if (!isOffline) {
      // If online, execute the function
      return executeFunction();
    }
    
    // If offline, queue the operation
    await this.operationQueue.add(operation);
    
    // Return a placeholder response
    return {
      _offlinePlaceholder: true,
      queuedAt: Date.now(),
      operation
    };
  }

  /**
   * Process the operation queue
   * 
   * @param {Function} processFunction - Function to process each operation
   * @returns {Promise<Array>} - Results of processed operations
   */
  /**
   * Store a reference to the execution function
   * 
   * @param {Function} fn - The API client's execution function
   */
  setExecuteFunction(fn) {
    this.executeFunction = fn;
  }
  
  /**
   * Process the operation queue
   * 
   * @param {Function} processFunction - Function to process each operation
   * @returns {Promise<Array>} - Results of processed operations
   */
  async processQueue(processFunction) {
    // Check if we're online
    const isOffline = await this.isOffline();
    
    if (isOffline) {
      throw new Error('Cannot process queue while offline');
    }
    
    // Get pending operations
    const pendingOperations = await this.operationQueue.getPendingOperations();
    
    if (pendingOperations.length === 0) {
      return [];
    }
    
    console.log(`[Offline] Processing ${pendingOperations.length} queued operations`);
    
    // Process each operation
    const results = [];
    
    for (const queuedOp of pendingOperations) {
      try {
        // Process the operation
        const result = await processFunction(queuedOp.operation);
        
        // Store the result
        results.push({
          id: queuedOp.id,
          result,
          success: true
        });
        
        // Remove the operation from the queue
        await this.operationQueue.remove(queuedOp.id);
        console.log(`[Offline] Successfully processed operation ${queuedOp.id}`);
      } catch (error) {
        // Store the error
        results.push({
          id: queuedOp.id,
          error: error.message,
          success: false
        });
        
        console.error(`[Offline] Failed to process operation ${queuedOp.id}: ${error.message}`);
        // Do not remove failed operations to allow retry
      }
    }
    
    return results;
  }

  /**
   * Save data to the persistent cache
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @param {Object} data - Data to cache
   * @param {number} ttl - Time-to-live in milliseconds
   * @returns {Promise<void>}
   */
  async saveToCache(endpoint, options, data, ttl) {
    if (!this.enabled) {
      return;
    }
    
    // Create or access persistent cache storage if not already initialized
    if (!this.persistentCache) {
      this.persistentCache = new PersistentCacheStorage({
        cachePath: this.config.cachePath
      });
      
      // Initialize the cache storage
      try {
        await this.persistentCache.init();
      } catch (error) {
        console.error('Failed to initialize persistent cache:', error);
        return;
      }
    }
    
    // Generate a consistent cache key
    const cacheKey = this._generateCacheKey(endpoint, options);
    
    // Calculate expiration time
    const expires = ttl ? Date.now() + ttl : null;
    
    // Store the data in persistent cache
    try {
      await this.persistentCache.save(cacheKey, {
        data,
        expires,
        endpoint,
        method: options.method || 'GET',
      });
      
      if (this.config.logLevel === 'debug') {
        console.log(`[Offline] Saved to persistent cache: ${endpoint}`);
      }
    } catch (error) {
      console.error(`Failed to save data to persistent cache for ${endpoint}:`, error);
    }
  }
  
  /**
   * Generate a consistent cache key from endpoint and options
   * 
   * @private
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {string} - Cache key
   */
  _generateCacheKey(endpoint, options) {
    // Use endpoint as base key
    let key = endpoint;
    
    // Add method to key
    const method = options.method || 'GET';
    key += `::${method}`;
    
    // Add body hash to key if present (for POST/PUT/PATCH)
    if (options.body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      try {
        // Try to create a consistent hash of the body
        const bodyStr = typeof options.body === 'string' 
          ? options.body 
          : JSON.stringify(options.body);
          
        // Simple string hash function
        let hash = 0;
        for (let i = 0; i < bodyStr.length; i++) {
          const char = bodyStr.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        key += `::${hash}`;
      } catch (error) {
        // If hashing fails, add a timestamp to ensure uniqueness
        key += `::${Date.now()}`;
      }
    }
    
    return key;
  }
}
