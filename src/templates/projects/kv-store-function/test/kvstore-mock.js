/**
 * KV Store Mock for Testing
 * 
 * This module provides a mock implementation of the Glia Functions KV Store
 * for use in unit tests. It mimics the behavior of the real KV Store API.
 */

/**
 * Mock KV Store Factory
 * Creates mock KV Store instances for testing
 */
export class MockKvStoreFactory {
  constructor() {
    this.stores = new Map();
  }
  
  /**
   * Initialize a KV Store instance with the given namespace
   * 
   * @param {string} namespace - The KV store namespace
   * @returns {MockKvStore} - The mock KV store instance
   */
  initializeKvStore(namespace) {
    if (!this.stores.has(namespace)) {
      this.stores.set(namespace, new MockKvStore(namespace));
    }
    return this.stores.get(namespace);
  }
  
  /**
   * Reset all store data (for testing)
   */
  reset() {
    this.stores.clear();
  }
}

/**
 * Mock KV Store Implementation
 */
class MockKvStore {
  constructor(namespace) {
    this.namespace = namespace;
    this.data = new Map();
  }
  
  /**
   * Get a value from the KV store
   * 
   * @param {string} key - The key to get
   * @returns {Promise<Object>} - KV store result
   */
  async get(key) {
    const entry = this.data.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if the entry is expired
    if (entry.expires && entry.expires < Date.now()) {
      this.data.delete(key);
      return null;
    }
    
    return {
      key,
      value: entry.value,
      expires: entry.expires
    };
  }
  
  /**
   * Set a value in the KV store
   * 
   * @param {Object} options - Set operation options
   * @param {string} options.key - The key to set
   * @param {any} options.value - The value to set
   * @param {number} [options.expirationTtl] - TTL in seconds
   * @returns {Promise<Object>} - KV store result
   */
  async set({ key, value, expirationTtl }) {
    // Calculate expiration timestamp if TTL is provided
    let expires = null;
    if (expirationTtl) {
      expires = Date.now() + (expirationTtl * 1000);
    }
    
    // Store the entry
    this.data.set(key, {
      value,
      expires
    });
    
    return {
      key,
      value,
      expires
    };
  }
  
  /**
   * Delete a value from the KV store
   * 
   * @param {string} key - The key to delete
   * @returns {Promise<Object>} - KV store result
   */
  async delete(key) {
    this.data.delete(key);
    
    return {
      key,
      deleted: true
    };
  }
  
  /**
   * Test and set a value in the KV store (conditional update)
   * 
   * @param {Object} options - Test-and-set operation options
   * @param {string} options.key - The key to update
   * @param {any} options.oldValue - Expected current value
   * @param {any} options.newValue - New value to set
   * @param {number} [options.expirationTtl] - TTL in seconds
   * @returns {Promise<Object>} - KV store result
   */
  async testAndSet({ key, oldValue, newValue, expirationTtl }) {
    const entry = await this.get(key);
    
    // Check if the current value matches the expected value
    if (!entry || entry.value !== oldValue) {
      return {
        key,
        value: null,
        expires: null
      };
    }
    
    // If the condition is met, update the value
    return await this.set({ key, value: newValue, expirationTtl });
  }
  
  /**
   * Process multiple operations in a batch
   * 
   * @param {Array} operations - Array of operations
   * @returns {Promise<Array>} - Array of operation results
   */
  async processBatchOperations(operations) {
    const results = [];
    
    for (const op of operations) {
      try {
        switch (op.op.toLowerCase()) {
          case 'get':
            results.push(await this.get(op.key));
            break;
          case 'set':
            results.push(await this.set({ 
              key: op.key, 
              value: op.value,
              expirationTtl: op.expirationTtl
            }));
            break;
          case 'delete':
            results.push(await this.delete(op.key));
            break;
          case 'testandset':
          case 'test-and-set':
            results.push(await this.testAndSet({
              key: op.key,
              oldValue: op.oldValue,
              newValue: op.newValue,
              expirationTtl: op.expirationTtl
            }));
            break;
          default:
            results.push({
              error: `Invalid operation: ${op.op}`,
              success: false
            });
        }
      } catch (error) {
        results.push({
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }
  
  /**
   * Create an async iterator for listing items
   * 
   * @param {Object} [options] - List options
   * @param {string} [options.prefix] - Key prefix to filter by
   * @returns {AsyncIterator} - Async iterator for KV items
   */
  itemsAsyncIterator(options = {}) {
    const { prefix = '' } = options;
    
    // Create a filtered array of items with the given prefix
    const items = Array.from(this.data.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, entry]) => {
        // Skip expired items
        if (entry.expires && entry.expires < Date.now()) {
          return null;
        }
        
        return {
          key,
          value: entry.value,
          expires: entry.expires
        };
      })
      .filter(Boolean); // Remove nulls (expired items)
    
    // Return an async iterator
    return {
      [Symbol.asyncIterator]() {
        let index = 0;
        
        return {
          async next() {
            if (index < items.length) {
              return { 
                value: items[index++], 
                done: false 
              };
            }
            
            return { done: true };
          }
        };
      }
    };
  }
}

export default MockKvStoreFactory;