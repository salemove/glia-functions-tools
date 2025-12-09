import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Mock dependencies
jest.mock('../../../../src/lib/config.js');
jest.mock('../../../../src/cli/error-handler.js');

// Import the mocked dependencies
import { updateProfile, getProfileConfig, listProfiles } from '../../../../src/lib/config.js';
import { showSuccess, showError, showWarning } from '../../../../src/cli/error-handler.js';

// Import the command to test
import updateProfileCommand from '../../../../src/commands/profiles/updateProfile.js';

describe('updateProfile command', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup default mocks
    listProfiles.mockReturnValue(['profile1', 'profile2']);
    updateProfile.mockResolvedValue();
    getProfileConfig.mockReturnValue({});

    // Mock console.log
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  it('should update site ID for a profile', async () => {
    // Setup existing config
    getProfileConfig.mockReturnValue({
      GLIA_SITE_ID: 'old-site-id'
    });

    // Call the command
    const result = await updateProfileCommand({
      name: 'profile1',
      siteId: 'new-site-id'
    });

    // Check that updateProfile was called with correct args
    expect(updateProfile).toHaveBeenCalledWith('profile1', {
      GLIA_SITE_ID: 'new-site-id'
    });

    // Check that success message was shown
    expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('profile1'));

    // Check result
    expect(result).toEqual({
      success: true,
      profileName: 'profile1',
      updates: { GLIA_SITE_ID: 'new-site-id' },
      message: expect.stringContaining('profile1')
    });
  });

  it('should update API credentials for a profile', async () => {
    // Call the command with credentials
    const result = await updateProfileCommand({
      name: 'profile1',
      keyId: 'new-key-id',
      keySecret: 'new-key-secret'
    });

    // Check that updateProfile was called with correct args
    expect(updateProfile).toHaveBeenCalledWith('profile1', {
      GLIA_KEY_ID: 'new-key-id',
      GLIA_KEY_SECRET: 'new-key-secret'
    });

    // Check result
    expect(result.success).toBe(true);
    expect(result.updates).toEqual({
      GLIA_KEY_ID: 'new-key-id',
      GLIA_KEY_SECRET: 'new-key-secret'
    });
  });

  it('should update API URL for a profile', async () => {
    // Call the command
    const result = await updateProfileCommand({
      name: 'profile1',
      apiUrl: 'https://custom-api.glia.com'
    });

    // Check that updateProfile was called with correct args
    expect(updateProfile).toHaveBeenCalledWith('profile1', {
      GLIA_API_URL: 'https://custom-api.glia.com'
    });

    // Check result
    expect(result.success).toBe(true);
  });

  it('should update multiple fields at once', async () => {
    // Call the command with multiple updates
    const result = await updateProfileCommand({
      name: 'profile1',
      siteId: 'new-site-id',
      keyId: 'new-key-id',
      apiUrl: 'https://custom-api.glia.com'
    });

    // Check that updateProfile was called with all updates
    expect(updateProfile).toHaveBeenCalledWith('profile1', {
      GLIA_SITE_ID: 'new-site-id',
      GLIA_KEY_ID: 'new-key-id',
      GLIA_API_URL: 'https://custom-api.glia.com'
    });

    // Check result
    expect(result.success).toBe(true);
    expect(Object.keys(result.updates)).toHaveLength(3);
  });

  it('should handle custom variables', async () => {
    // Call the command with custom variables
    const result = await updateProfileCommand({
      name: 'profile1',
      customVars: {
        CUSTOM_VAR_1: 'value1',
        CUSTOM_VAR_2: 'value2'
      }
    });

    // Check that updateProfile was called with custom vars
    expect(updateProfile).toHaveBeenCalledWith('profile1', {
      CUSTOM_VAR_1: 'value1',
      CUSTOM_VAR_2: 'value2'
    });

    // Check result
    expect(result.success).toBe(true);
  });

  it('should handle missing profile name', async () => {
    // Call the command with no profile name
    await expect(updateProfileCommand({}))
      .rejects.toThrow('Profile name is required');

    // Check that error was shown
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Profile name is required'));

    // Check that updateProfile was not called
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('should handle non-existent profile', async () => {
    // Mock listProfiles to not include the invalid profile
    listProfiles.mockReturnValue(['profile1', 'profile2']);

    // Call the command with invalid profile
    await expect(updateProfileCommand({
      name: 'invalid',
      siteId: 'new-site-id'
    })).rejects.toThrow("Profile 'invalid' does not exist");

    // Check that error was shown
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Failed to update profile'));
  });

  it('should handle no updates provided', async () => {
    // Call the command with no updates
    const result = await updateProfileCommand({ name: 'profile1' });

    // Check that warning was shown
    expect(showWarning).toHaveBeenCalledWith('No configuration updates provided');

    // Check that updateProfile was not called
    expect(updateProfile).not.toHaveBeenCalled();

    // Check result
    expect(result).toEqual({
      success: false,
      profileName: 'profile1',
      message: 'No updates provided'
    });
  });

  it('should handle default profile updates', async () => {
    // Call the command for default profile
    const result = await updateProfileCommand({
      name: 'default',
      siteId: 'default-site-id'
    });

    // Check that updateProfile was called
    expect(updateProfile).toHaveBeenCalledWith('default', {
      GLIA_SITE_ID: 'default-site-id'
    });

    // Check result
    expect(result.success).toBe(true);
    expect(result.profileName).toBe('default');
  });

  it('should display current values before update', async () => {
    // Setup existing config
    getProfileConfig.mockReturnValue({
      GLIA_SITE_ID: 'old-site-id',
      GLIA_KEY_ID: 'old-key-id'
    });

    // Call the command
    await updateProfileCommand({
      name: 'profile1',
      siteId: 'new-site-id'
    });

    // Check that getProfileConfig was called to get current config
    expect(getProfileConfig).toHaveBeenCalledWith('profile1');

    // Check that console.log was called (displaying before/after)
    expect(console.log).toHaveBeenCalled();
  });

  it('should mask sensitive values in output', async () => {
    // Setup existing config with sensitive data
    getProfileConfig.mockReturnValue({
      GLIA_KEY_SECRET: 'old-secret-value'
    });

    // Call the command to update secret
    await updateProfileCommand({
      name: 'profile1',
      keySecret: 'new-secret-value'
    });

    // Check that console.log was called
    const logCalls = console.log.mock.calls.map(call => call.join(' '));

    // Check that the actual secret values are not in the output
    const hasUnmaskedOldSecret = logCalls.some(call => call.includes('old-secret-value'));
    const hasUnmaskedNewSecret = logCalls.some(call => call.includes('new-secret-value'));

    // Secrets should be masked
    expect(hasUnmaskedOldSecret).toBe(false);
    expect(hasUnmaskedNewSecret).toBe(false);

    // But we should have some masked output (***)
    const hasMaskedOutput = logCalls.some(call => call.includes('***'));
    expect(hasMaskedOutput).toBe(true);
  });

  it('should handle errors during update', async () => {
    // Setup updateProfile to throw error
    const errorMessage = 'Failed to write to profile file';
    updateProfile.mockRejectedValue(new Error(errorMessage));

    // Call the command
    await expect(updateProfileCommand({
      name: 'profile1',
      siteId: 'new-site-id'
    })).rejects.toThrow(errorMessage);

    // Check that error was shown
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Failed to update profile'));
  });
});
