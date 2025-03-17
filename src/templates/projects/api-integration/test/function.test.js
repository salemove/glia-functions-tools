/**
 * {{projectName}} Tests
 */

// Import the function to test
import { onInvoke } from '../function.js';
import { makeApiRequest } from '../lib/api-client.js';
import { validateInput } from '../lib/validator.js';

// Mocks
jest.mock('../lib/api-client.js');
jest.mock('../lib/validator.js');

// Mock for Response.JSON
globalThis.Response = {
  JSON: jest.fn((data, options) => ({ json: () => data, options }))
};

describe('{{projectName}}', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Default mock implementations
    validateInput.mockImplementation(() => true);
    makeApiRequest.mockResolvedValue({ result: 'success' });
  });

  it('should return a success response with valid input', async () => {
    // Arrange
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        payload: JSON.stringify({ query: 'test query' })
      })
    };
    
    const mockEnv = {
      API_KEY: 'test-api-key',
      API_URL: 'https://api.example.com'
    };
    
    // Act
    const response = await onInvoke(mockRequest, mockEnv);
    
    // Assert
    expect(validateInput).toHaveBeenCalledWith({ query: 'test query' });
    expect(makeApiRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com',
      method: 'POST',
      apiKey: 'test-api-key'
    }));
    
    expect(Response.JSON).toHaveBeenCalledWith({
      success: true,
      data: { result: 'success' },
      metadata: expect.objectContaining({
        timestamp: expect.any(String),
        query: 'test query',
        source: '{{projectName}}'
      })
    });
  });

  it('should handle validation errors', async () => {
    // Arrange
    validateInput.mockImplementation(() => {
      const error = new Error('Invalid input');
      error.name = 'ValidationError';
      throw error;
    });
    
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        payload: JSON.stringify({ query: '' })
      })
    };
    
    const mockEnv = {
      API_KEY: 'test-api-key'
    };
    
    // Act
    const response = await onInvoke(mockRequest, mockEnv);
    
    // Assert
    expect(Response.JSON).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid input',
      errorCode: 'UNKNOWN_ERROR',
      timestamp: expect.any(String)
    }, { status: 400 });
  });

  it('should handle missing API key', async () => {
    // Arrange
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        payload: JSON.stringify({ query: 'test' })
      })
    };
    
    const mockEnv = {}; // No API key
    
    // Act
    const response = await onInvoke(mockRequest, mockEnv);
    
    // Assert
    expect(Response.JSON).toHaveBeenCalledWith({
      success: false,
      error: 'Missing API_KEY environment variable',
      errorCode: 'UNKNOWN_ERROR',
      timestamp: expect.any(String)
    }, { status: 500 });
  });

  it('should handle API client errors', async () => {
    // Arrange
    makeApiRequest.mockRejectedValue({
      name: 'ApiError',
      message: 'API connection failed',
      code: 'CONNECTION_ERROR'
    });
    
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        payload: JSON.stringify({ query: 'test' })
      })
    };
    
    const mockEnv = {
      API_KEY: 'test-api-key'
    };
    
    // Act
    const response = await onInvoke(mockRequest, mockEnv);
    
    // Assert
    expect(Response.JSON).toHaveBeenCalledWith({
      success: false,
      error: 'API connection failed',
      errorCode: 'CONNECTION_ERROR',
      timestamp: expect.any(String)
    }, { status: 500 });
  });
});