import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { fetchLogs } from '../../../src/commands/fetchLogs.js';
import GliaApiClient from '../../../src/lib/api.js';
import * as configModule from '../../../src/lib/config.js';
import fs from 'fs/promises';

// Mock dependencies
jest.mock('../../../src/lib/api.js');
jest.mock('../../../src/lib/config.js');
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined)
}));

describe('fetchLogs command', () => {
  // Mock data
  const mockApiConfig = {
    apiUrl: 'https://test-api.glia.com',
    siteId: 'test-site-id',
    bearerToken: 'test-bearer-token'
  };
  
  // Mock log data
  const mockFirstPageLogs = {
    logs: [
      { timestamp: '2023-10-19T12:00:00Z', message: 'Page 1 - Log 1' },
      { timestamp: '2023-10-19T12:01:00Z', message: 'Page 1 - Log 2' }
    ],
    next_page: 'https://test-api.glia.com/functions/func-123/logs?page_token=token1'
  };
  
  const mockSecondPageLogs = {
    logs: [
      { timestamp: '2023-10-19T12:02:00Z', message: 'Page 2 - Log 1' },
      { timestamp: '2023-10-19T12:03:00Z', message: 'Page 2 - Log 2' }
    ],
    next_page: null
  };
  
  // Setup mocks
  let mockGetFunctionLogs;
  let mockMakeRequest;
  let mockCommand;
  
  beforeEach(() => {
    // Setup API client mock
    mockGetFunctionLogs = jest.fn().mockResolvedValue(mockFirstPageLogs);
    mockMakeRequest = jest.fn().mockResolvedValue(mockSecondPageLogs);
    
    GliaApiClient.mockImplementation(() => ({
      getFunctionLogs: mockGetFunctionLogs,
      makeRequest: mockMakeRequest
    }));
    
    // Setup config mock
    configModule.getApiConfig = jest.fn().mockResolvedValue(mockApiConfig);
    
    // Setup mock command for progress reporting
    mockCommand = {
      info: jest.fn()
    };
  });
  
  afterEach(() => {
    // Clear mocks
    jest.clearAllMocks();
  });
  
  it('should fetch a single page of logs with default options', async () => {
    const functionId = 'func-123';
    const logsOptions = { limit: 100 };
    
    const result = await fetchLogs({
      functionId,
      logsOptions
    });
    
    // Verify API client was created with correct config
    expect(GliaApiClient).toHaveBeenCalledWith(mockApiConfig);
    
    // Verify getFunctionLogs was called with correct args
    expect(mockGetFunctionLogs).toHaveBeenCalledWith(functionId, logsOptions);
    
    // Verify we didn't use pagination
    expect(mockMakeRequest).not.toHaveBeenCalled();
    
    // Verify result contains expected logs
    expect(result).toEqual(mockFirstPageLogs);
  });
  
  it('should write logs to a file when outputPath is provided', async () => {
    const functionId = 'func-123';
    const logsOptions = { limit: 100 };
    const outputPath = './test-logs.json';
    
    await fetchLogs({
      functionId,
      logsOptions,
      outputPath
    });
    
    // Verify the file was written with correct data
    expect(fs.writeFile).toHaveBeenCalledWith(
      outputPath,
      JSON.stringify(mockFirstPageLogs, null, 2)
    );
  });
  
  it('should fetch all logs across multiple pages when fetchAll is true', async () => {
    const functionId = 'func-123';
    const logsOptions = { limit: 100 };
    
    const result = await fetchLogs({
      functionId,
      logsOptions,
      fetchAll: true,
      command: mockCommand
    });
    
    // Verify initial function call
    expect(mockGetFunctionLogs).toHaveBeenCalledWith(functionId, logsOptions);
    
    // Verify pagination call
    expect(mockMakeRequest).toHaveBeenCalledWith(
      mockFirstPageLogs.next_page,
      {},
      { useCache: false, useRetry: true }
    );
    
    // Verify progress reporting
    expect(mockCommand.info).toHaveBeenCalledWith('Fetched page 1 with 2 entries...');
    expect(mockCommand.info).toHaveBeenCalledWith('Fetched page 2 with 2 entries...');
    
    // Expected combined logs
    const expectedLogs = [
      ...mockFirstPageLogs.logs,
      ...mockSecondPageLogs.logs
    ];
    
    // Verify we got the expected combined result
    expect(result).toEqual({
      logs: expectedLogs,
      next_page: null
    });
  });
  
  it('should handle empty logs case', async () => {
    const emptyLogs = {
      logs: [],
      next_page: null
    };
    
    mockGetFunctionLogs.mockResolvedValue(emptyLogs);
    
    const functionId = 'func-123';
    const logsOptions = { limit: 100 };
    
    const result = await fetchLogs({
      functionId,
      logsOptions
    });
    
    // Verify result contains empty logs
    expect(result).toEqual(emptyLogs);
  });
  
  it('should propagate errors from the API client', async () => {
    const testError = new Error('API error');
    mockGetFunctionLogs.mockRejectedValue(testError);
    
    const functionId = 'func-123';
    const logsOptions = { limit: 100 };
    
    // Verify function properly re-throws the error
    await expect(fetchLogs({
      functionId,
      logsOptions
    })).rejects.toThrow(testError);
  });
});