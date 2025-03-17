import { jest } from '@jest/globals';
import { listFunctions } from '../../../src/commands/listFunctions.js';
import GliaApiClient from '../../../src/lib/api.js';
import * as configModule from '../../../src/lib/config.js';

// Mock dependencies
jest.mock('../../../src/lib/api.js');
jest.mock('../../../src/lib/config.js');

describe('listFunctions command', () => {
  // Setup mocks
  const mockApiConfig = {
    apiUrl: 'https://test-api.glia.com',
    siteId: 'test-site-id',
    bearerToken: 'test-bearer-token'
  };
  
  const mockFunctions = {
    functions: [
      { id: 'func1', name: 'Function 1' },
      { id: 'func2', name: 'Function 2' }
    ]
  };
  
  let mockListFunctions;
  let consoleLogSpy;
  
  beforeEach(() => {
    // Setup API client mock
    mockListFunctions = jest.fn().mockResolvedValue(mockFunctions);
    GliaApiClient.mockImplementation(() => ({
      listFunctions: mockListFunctions
    }));
    
    // Setup config mock
    configModule.getApiConfig = jest.fn().mockResolvedValue(mockApiConfig);
    
    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });
  
  afterEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
  });
  
  it('should list functions with default options', async () => {
    await listFunctions();
    
    // Verify API client was created with correct config
    expect(GliaApiClient).toHaveBeenCalledWith(mockApiConfig);
    
    // Verify listFunctions was called
    expect(mockListFunctions).toHaveBeenCalled();
    
    // Verify console output
    expect(consoleLogSpy).toHaveBeenCalledWith('Retrieving functions list...');
    expect(consoleLogSpy).toHaveBeenCalledWith(`Found ${mockFunctions.functions.length} functions:`);
    expect(consoleLogSpy).toHaveBeenCalledWith('- Function 1 (func1)');
    expect(consoleLogSpy).toHaveBeenCalledWith('- Function 2 (func2)');
  });
  
  it('should list functions with detailed output', async () => {
    await listFunctions({ detailed: true });
    
    // Verify API client was created with correct config
    expect(GliaApiClient).toHaveBeenCalledWith(mockApiConfig);
    
    // Verify listFunctions was called
    expect(mockListFunctions).toHaveBeenCalled();
    
    // Verify console output
    expect(consoleLogSpy).toHaveBeenCalledWith('Retrieving functions list...');
    expect(consoleLogSpy).toHaveBeenCalledWith('Functions:');
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(mockFunctions, null, 2));
  });
  
  it('should handle errors properly', async () => {
    const testError = new Error('API error');
    mockListFunctions.mockRejectedValue(testError);
    
    // Verify function properly re-throws the error
    await expect(listFunctions()).rejects.toThrow(testError);
  });
});
