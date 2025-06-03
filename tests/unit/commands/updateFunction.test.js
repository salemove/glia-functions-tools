/**
 * Tests for the update-function command
 */
import { jest } from '@jest/globals';
import { updateFunction } from '../../../src/commands/updateFunction.js';

// Mock dependencies
const updateFunctionMock = jest.fn();

jest.mock('../../../src/lib/api.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    updateFunction: updateFunctionMock
  }))
}));

jest.mock('../../../src/lib/config.js', () => ({
  __esModule: true,
  getApiConfig: jest.fn().mockResolvedValue({
    apiUrl: 'https://test-api.glia.com',
    siteId: 'test-site',
    bearerToken: 'test-token'
  })
}));

describe('updateFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up the default behavior for the mock
    updateFunctionMock.mockResolvedValue({
      id: 'test-id',
      name: 'Updated Function',
      description: 'Updated description',
      site_id: 'test-site'
    });
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  it('should update function name', async () => {
    const result = await updateFunction({
      id: 'test-id',
      name: 'Updated Function'
    });
    
    expect(updateFunctionMock).toHaveBeenCalledWith(
      'test-id',
      { name: 'Updated Function' }
    );
    
    expect(result).toEqual({
      id: 'test-id',
      name: 'Updated Function',
      description: 'Updated description',
      site_id: 'test-site'
    });
  });
  
  it('should update function description', async () => {
    const result = await updateFunction({
      id: 'test-id',
      description: 'Updated description'
    });
    
    expect(updateFunctionMock).toHaveBeenCalledWith(
      'test-id',
      { description: 'Updated description' }
    );
    
    expect(result).toEqual({
      id: 'test-id',
      name: 'Updated Function',
      description: 'Updated description',
      site_id: 'test-site'
    });
  });
  
  it('should update both name and description', async () => {
    const result = await updateFunction({
      id: 'test-id',
      name: 'New Name',
      description: 'New description'
    });
    
    expect(updateFunctionMock).toHaveBeenCalledWith(
      'test-id',
      { 
        name: 'New Name',
        description: 'New description'
      }
    );
    
    expect(result).toEqual({
      id: 'test-id',
      name: 'Updated Function',
      description: 'Updated description',
      site_id: 'test-site'
    });
  });
  
  it('should handle errors properly', async () => {
    const error = new Error('API error');
    updateFunctionMock.mockRejectedValueOnce(error);
    
    await expect(updateFunction({
      id: 'test-id',
      name: 'Updated Function'
    })).rejects.toThrow('API error');
    
    expect(console.error).toHaveBeenCalledWith('Error updating function:', error);
  });
});