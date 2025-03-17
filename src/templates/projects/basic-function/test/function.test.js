/**
 * {{projectName}} Tests
 */

// Import the function to test
import { onInvoke } from '../function.js';

// Mock for Response.JSON
globalThis.Response = {
  JSON: jest.fn((data) => ({ json: () => data }))
};

describe('{{projectName}}', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  it('should return a success response with valid input', async () => {
    // Arrange
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        payload: JSON.stringify({ test: 'data' })
      })
    };
    
    const mockEnv = {};
    
    // Act
    const response = await onInvoke(mockRequest, mockEnv);
    
    // Assert
    expect(Response.JSON).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        message: 'Hello from {{projectName}}!',
        timestamp: expect.any(String),
        receivedData: { test: 'data' }
      })
    });
    
    expect(console.log).toHaveBeenCalledWith('Processing request from {{projectName}}');
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    const mockRequest = {
      json: jest.fn().mockRejectedValue(new Error('Test error'))
    };
    
    const mockEnv = {};
    
    // Act
    const response = await onInvoke(mockRequest, mockEnv);
    
    // Assert
    expect(Response.JSON).toHaveBeenCalledWith({
      success: false,
      error: 'Test error',
      timestamp: expect.any(String)
    }, { status: 500 });
    
    expect(console.error).toHaveBeenCalledWith('Error processing request:', expect.any(Error));
  });
});