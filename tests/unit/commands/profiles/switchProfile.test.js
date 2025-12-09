import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Mock dependencies
jest.mock('../../../../src/lib/config.js');
jest.mock('../../../../src/cli/error-handler.js');
jest.mock('../../../../src/lib/cache.js');
jest.mock('../../../../src/lib/api.js');

// Import the mocked dependencies
import { switchProfile, listProfiles } from '../../../../src/lib/config.js';
import { showSuccess, showError, showWarning, showInfo } from '../../../../src/cli/error-handler.js';
import { ResponseCache } from '../../../../src/lib/cache.js';

// Import the command to test
import switchProfileCommand from '../../../../src/commands/profiles/switchProfile.js';

describe('switchProfile command', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mocks
    listProfiles.mockReturnValue(['profile1', 'profile2']);
    switchProfile.mockResolvedValue('profile1');
    
    // Mock global.apiClient
    global.apiClient = {
      cache: {
        clear: jest.fn()
      }
    };
  });
  
  afterEach(() => {
    delete global.apiClient;
  });
  
  it('should switch to a valid profile and clear cache', async () => {
    // Call the command
    const result = await switchProfileCommand({ name: 'profile1' });
    
    // Check that config.switchProfile was called
    expect(switchProfile).toHaveBeenCalledWith('profile1');
    
    // Check that the cache was cleared
    expect(global.apiClient.cache.clear).toHaveBeenCalled();
    
    // Check that success messages were shown
    expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('profile1'));
    expect(showInfo).toHaveBeenCalledTimes(2);
    
    // Check result
    expect(result).toEqual({
      success: true,
      profileName: 'profile1',
      message: expect.stringContaining('profile1')
    });
  });
  
  it('should create a temporary cache if no global api client exists', async () => {
    // Remove global api client
    delete global.apiClient;
    
    // Mock ResponseCache
    const mockCache = { clear: jest.fn() };
    ResponseCache.mockImplementation(() => mockCache);
    
    // Call the command
    await switchProfileCommand({ name: 'profile1' });
    
    // Check that a temporary cache was created and cleared
    expect(ResponseCache).toHaveBeenCalledWith({ persistent: true });
    expect(mockCache.clear).toHaveBeenCalled();
  });
  
  it('should handle non-existent profiles', async () => {
    // Setup error for non-existent profile
    const errorMessage = `Profile 'invalid' does not exist`;
    
    // Call the command with invalid profile
    await expect(switchProfileCommand({ name: 'invalid' }))
      .rejects.toThrow(errorMessage);
    
    // Check that warning and error were shown
    expect(showWarning).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
    expect(showError).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
    
    // Check that switchProfile was not called
    expect(switchProfile).not.toHaveBeenCalled();
  });
  
  it('should handle missing profile name', async () => {
    // Call the command with no profile name
    await expect(switchProfileCommand({}))
      .rejects.toThrow('Profile name is required');
    
    // Check that error was shown
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Profile name is required'));
    
    // Check that switchProfile was not called
    expect(switchProfile).not.toHaveBeenCalled();
  });
  
  it('should handle errors when clearing cache', async () => {
    // Setup cache clearing to throw error
    const cacheError = new Error('Cache error');
    global.apiClient.cache.clear.mockImplementation(() => {
      throw cacheError;
    });
    
    // Call the command
    await switchProfileCommand({ name: 'profile1' });
    
    // Check that warning was shown for cache error
    expect(showWarning).toHaveBeenCalledWith(expect.stringContaining('Could not clear API cache'));
    
    // Check that profile was still switched
    expect(switchProfile).toHaveBeenCalledWith('profile1');
    expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('profile1'));
  });
});