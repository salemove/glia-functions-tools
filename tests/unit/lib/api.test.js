import { jest } from '@jest/globals';
import GliaApiClient from '../../../src/lib/api.js';
import { 
  GliaError, 
  AuthenticationError, 
  FunctionError,
  NetworkError,
  ValidationError,
  RateLimitError
} from '../../../src/lib/errors.js';
import fetchMock from 'jest-fetch-mock';

describe('GliaApiClient', () => {
  // Setup test configuration
  const config = {
    apiUrl: 'https://test-api.glia.com',
    siteId: 'test-site-id',
    bearerToken: 'test-bearer-token'
  };
  
  let api;
  
  beforeEach(() => {
    fetchMock.resetMocks();
    api = new GliaApiClient(config);
  });
  
  describe('constructor', () => {
    it('should create a new API client with correct properties', () => {
      expect(api.baseUrl).toBe(config.apiUrl);
      expect(api.siteId).toBe(config.siteId);
      expect(api.bearerToken).toBe(config.bearerToken);
    });
  });
  
  describe('makeRequest', () => {
    it('should make a request to the API with correct headers', async () => {
      const mockResponse = { success: true };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.makeRequest('/test-endpoint');
      
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('https://test-api.glia.com/test-endpoint', 
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-bearer-token',
            'Content-Type': 'application/json'
          }),
          signal: expect.any(AbortSignal)
        })
      );
      expect(result).toEqual(mockResponse);
    });
    
    it('should handle non-JSON responses', async () => {
      const plainTextResponse = 'Plain text response';
      fetchMock.mockResponseOnce(plainTextResponse, {
        headers: { 'Content-Type': 'text/plain' }
      });
      
      const result = await api.makeRequest('/text-endpoint');
      
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(plainTextResponse);
    });
    
    it('should throw AuthenticationError for 401 responses', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      
      await expect(api.makeRequest('/test-endpoint')).rejects.toThrow(AuthenticationError);
      await expect(api.makeRequest('/test-endpoint')).rejects.toThrow('Authentication failed');
    });
    
    it('should throw GliaError for 404 responses', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ error: 'Not found' }), { status: 404 });
      
      await expect(api.makeRequest('/test-endpoint')).rejects.toThrow(GliaError);
      await expect(api.makeRequest('/test-endpoint')).rejects.toThrow('Resource not found: /test-endpoint');
    });
    
    it('should throw GliaError for other error responses', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ error: 'Bad request' }), { status: 400 });
      
      await expect(api.makeRequest('/test-endpoint')).rejects.toThrow(ValidationError);
      await expect(api.makeRequest('/test-endpoint')).rejects.toThrow('Bad request');
    });
    
    it('should handle rate limiting correctly', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ error: 'Rate limit exceeded' }), { 
        status: 429,
        headers: {
          'x-rate-limit-limit': '100',
          'x-rate-limit-remaining': '0',
          'x-rate-limit-reset': '60',
          'retry-after': '30'
        }
      });
      
      try {
        await api.makeRequest('/test-endpoint');
        fail('Expected error was not thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect(error.message).toContain('Rate limit exceeded');
        expect(error.retryAfter).toBe(30);
        expect(error.limit).toBe(100);
        expect(error.remaining).toBe(0);
      }
    });
    
    it('should respect custom timeout settings', async () => {
      const mockResponse = { success: true };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      // Custom timeout of 5 seconds
      await api.makeRequest('/test-endpoint', {}, { timeout: 5000 });
      
      // Check that AbortSignal is included in the request
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });
    
    it('should wrap network errors in NetworkError', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.makeRequest('/test-endpoint')).rejects.toThrow(GliaError);
      await expect(api.makeRequest('/test-endpoint')).rejects.toContain('Network failure');
    });
  });
  
  describe('listFunctions', () => {
    it('should fetch functions list', async () => {
      const mockResponse = {
        functions: [
          { id: 'func1', name: 'Function 1' },
          { id: 'func2', name: 'Function 2' }
        ]
      };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.listFunctions();
      
      // Updated to use the new endpoint
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/functions?site_ids[]=${config.siteId}`, expect.any(Object));
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.listFunctions()).rejects.toThrow(FunctionError);
      await expect(api.listFunctions()).rejects.toThrow('Failed to list functions');
    });
  });
  
  describe('getFunction', () => {
    it('should fetch function details', async () => {
      const functionId = 'test-function-id';
      const mockResponse = { id: functionId, name: 'Test Function' };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.getFunction(functionId);
      
      // Updated to use the new endpoint
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/functions/${functionId}`, expect.any(Object));
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.getFunction('test-id')).rejects.toThrow(FunctionError);
      await expect(api.getFunction('test-id')).rejects.toThrow('Failed to get function');
    });
    
    it('should validate function ID', async () => {
      await expect(api.getFunction()).rejects.toThrow('Function ID is required');
      await expect(api.getFunction('')).rejects.toThrow('Function ID cannot be empty');
    });
  });
  
  describe('createFunction', () => {
    it('should create a new function', async () => {
      const name = 'New Function';
      const description = 'Test Description';
      const mockResponse = { id: 'new-function-id', name, description };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.createFunction(name, description);
      
      // Updated to use the new endpoint and include site_id in the request
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/functions`, {
        method: 'POST',
        body: JSON.stringify({ name, description, site_id: config.siteId }),
        headers: expect.any(Object)
      });
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.createFunction('New Function')).rejects.toThrow(FunctionError);
      await expect(api.createFunction('New Function')).rejects.toThrow('Failed to create function');
    });
    
    it('should validate function name', async () => {
      await expect(api.createFunction()).rejects.toThrow('Function name is required');
      await expect(api.createFunction('')).rejects.toThrow('Function name cannot be empty');
    });
  });
  
  describe('createVersion', () => {
    it('should create a new function version', async () => {
      const functionId = 'test-function-id';
      const code = 'function handler() { return "Hello World"; }';
      const options = {
        compatibilityDate: '2023-01-01',
        environmentVariables: { KEY: 'value' }
      };
      const mockResponse = { id: 'version-id', function_id: functionId };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.createVersion(functionId, code, options);
      
      // Updated to use the new endpoint and parameter names
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/functions/${functionId}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          code: code, // updated from code_bundle to code
          compatibility_date: options.compatibilityDate,
          environment_variables: options.environmentVariables
        }),
        headers: expect.any(Object)
      });
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.createVersion('test-id', 'code')).rejects.toThrow(FunctionError);
      await expect(api.createVersion('test-id', 'code')).rejects.toThrow('Failed to create function version');
    });
    
    it('should validate function ID', async () => {
      await expect(api.createVersion()).rejects.toThrow('Function ID is required');
      await expect(api.createVersion('')).rejects.toThrow('Function ID cannot be empty');
    });
  });
  
  describe('deployVersion', () => {
    it('should deploy a function version', async () => {
      const functionId = 'test-function-id';
      const versionId = 'test-version-id';
      const mockResponse = { success: true };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.deployVersion(functionId, versionId);
      
      // Updated to use the new endpoint and include version_id in the body
      expect(fetchMock).toHaveBeenCalledWith(
        `${config.apiUrl}/functions/${functionId}/deployments`,
        {
          method: 'POST',
          body: JSON.stringify({ version_id: versionId }),
          headers: expect.any(Object)
        }
      );
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.deployVersion('test-id', 'version-id')).rejects.toThrow(FunctionError);
      await expect(api.deployVersion('test-id', 'version-id')).rejects.toThrow('Failed to deploy function version');
    });
    
    it('should validate function ID and version ID', async () => {
      await expect(api.deployVersion()).rejects.toThrow('Function ID is required');
      await expect(api.deployVersion('test-id')).rejects.toThrow('Version ID is required');
    });
  });
  
  describe('getFunctionLogs', () => {
    it('should fetch function logs', async () => {
      const functionId = 'test-function-id';
      const options = { limit: 10, startTime: '2023-01-01', endTime: '2023-01-02' };
      const mockResponse = { logs: [{ message: 'Test log', timestamp: '2023-01-01T12:00:00Z' }] };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.getFunctionLogs(functionId, options);
      
      // Updated to use the new endpoint and parameter names
      expect(fetchMock).toHaveBeenCalledWith(
        `${config.apiUrl}/functions/${functionId}/logs?per_page=10&from=2023-01-01&to=2023-01-02`,
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });
    
    it('should handle missing options', async () => {
      const functionId = 'test-function-id';
      const mockResponse = { logs: [] };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.getFunctionLogs(functionId);
      
      // Updated to use the new endpoint
      expect(fetchMock).toHaveBeenCalledWith(
        `${config.apiUrl}/functions/${functionId}/logs`,
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.getFunctionLogs('test-id')).rejects.toThrow(FunctionError);
      await expect(api.getFunctionLogs('test-id')).rejects.toThrow('Failed to get function logs');
    });
    
    it('should validate function ID', async () => {
      await expect(api.getFunctionLogs()).rejects.toThrow('Function ID is required');
      await expect(api.getFunctionLogs('')).rejects.toThrow('Function ID cannot be empty');
    });
  });
  
  describe('invokeFunction', () => {
    it('should invoke a function with JSON payload', async () => {
      const invocationUri = '/integrations/bf5ab8d1-f14e-4205-b8af-bb517f910101/endpoint';
      const fullUrl = config.apiUrl + invocationUri;
      const payload = { key: 'value' };
      const mockResponse = { result: 'Success' };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.invokeFunction(invocationUri, payload);
      
      expect(fetchMock).toHaveBeenCalledWith(fullUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Authorization': 'Bearer test-bearer-token',
          'Content-Type': 'application/json'
        }
      });
      expect(result).toEqual(mockResponse);
    });
    
    it('should invoke a function with string payload', async () => {
      const invocationUri = '/integrations/bf5ab8d1-f14e-4205-b8af-bb517f910101/endpoint';
      const fullUrl = config.apiUrl + invocationUri;
      const payload = 'string payload';
      const mockResponse = { result: 'Success' };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.invokeFunction(invocationUri, payload);
      
      expect(fetchMock).toHaveBeenCalledWith(fullUrl, {
        method: 'POST',
        body: payload,
        headers: {
          'Authorization': 'Bearer test-bearer-token',
          'Content-Type': 'application/json'
        }
      });
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.invokeFunction('/integrations/test-id/endpoint')).rejects.toThrow(FunctionError);
      await expect(api.invokeFunction('/integrations/test-id/endpoint')).rejects.toContain('Failed to invoke function');
    });

    it('should handle absolute URLs', async () => {
      const absoluteUrl = 'https://external-api.com/invoke';
      const payload = { key: 'value' };
      const mockResponse = { result: 'Success' };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.invokeFunction(absoluteUrl, payload);
      
      expect(fetchMock).toHaveBeenCalledWith(absoluteUrl, expect.any(Object));
      expect(result).toEqual(mockResponse);
    });
    
    it('should validate invocation URI', async () => {
      await expect(api.invokeFunction()).rejects.toThrow('Invocation URI is required');
    });
  });
  
  describe('processOfflineQueue', () => {
    it('should process the offline queue if available', async () => {
      // Setup mock offline manager
      api.offlineManager = {
        processQueue: jest.fn().mockResolvedValue([
          { id: 'op1', result: { success: true }, success: true },
          { id: 'op2', error: 'Operation failed', success: false }
        ])
      };
      
      const results = await api.processOfflineQueue();
      
      expect(results).toHaveLength(2);
      expect(api.offlineManager.processQueue).toHaveBeenCalledTimes(1);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
    
    it('should return empty array if offline manager is not available', async () => {
      // Remove offline manager
      api.offlineManager = null;
      
      const results = await api.processOfflineQueue();
      
      expect(results).toEqual([]);
    });
  });

  describe('updateFunction', () => {
    it('should update a function\'s name and description', async () => {
      const functionId = 'test-function-id';
      const updates = {
        name: 'Updated Function',
        description: 'Updated Description'
      };
      const mockResponse = { 
        id: functionId, 
        name: updates.name, 
        description: updates.description 
      };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.updateFunction(functionId, updates);
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/functions/${functionId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
        headers: expect.objectContaining({
          'Authorization': `Bearer ${config.bearerToken}`,
          'Content-Type': 'application/json'
        }),
        signal: expect.any(AbortSignal)
      });
      expect(result).toEqual(mockResponse);
    });
    
    it('should update only name when only name is provided', async () => {
      const functionId = 'test-function-id';
      const updates = { name: 'Updated Function' };
      const mockResponse = { id: functionId, name: updates.name };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.updateFunction(functionId, updates);
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/functions/${functionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: updates.name }),
        headers: expect.anything(),
        signal: expect.anything()
      });
      expect(result).toEqual(mockResponse);
    });
    
    it('should update only description when only description is provided', async () => {
      const functionId = 'test-function-id';
      const updates = { description: 'Updated Description' };
      const mockResponse = { id: functionId, description: updates.description };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.updateFunction(functionId, updates);
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/functions/${functionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ description: updates.description }),
        headers: expect.anything(),
        signal: expect.anything()
      });
      expect(result).toEqual(mockResponse);
    });
    
    it('should validate function ID', async () => {
      const updates = { name: 'Updated Function' };
      
      await expect(api.updateFunction()).rejects.toThrow('Function ID is required');
      await expect(api.updateFunction('')).rejects.toThrow('Function ID cannot be empty');
    });
    
    it('should validate function name if provided', async () => {
      const functionId = 'test-function-id';
      const invalidUpdates = { name: '' };
      
      await expect(api.updateFunction(functionId, invalidUpdates)).rejects.toThrow('Function name cannot be empty');
    });
    
    it('should throw FunctionError on failure', async () => {
      const functionId = 'test-function-id';
      const updates = { name: 'Updated Function' };
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.updateFunction(functionId, updates)).rejects.toThrow(FunctionError);
      await expect(api.updateFunction(functionId, updates)).rejects.toThrow('Failed to update function');
    });
  });
});
