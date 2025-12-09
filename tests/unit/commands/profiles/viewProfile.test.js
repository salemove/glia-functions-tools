import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Mock dependencies
jest.mock('../../../../src/lib/config.js');
jest.mock('../../../../src/cli/error-handler.js');

// Import the mocked dependencies
import { getProfileConfig, listProfiles } from '../../../../src/lib/config.js';
import { showSuccess, showError, showWarning } from '../../../../src/cli/error-handler.js';

// Import the command to test
import viewProfileCommand from '../../../../src/commands/profiles/viewProfile.js';

describe('viewProfile command', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup default mocks
    listProfiles.mockReturnValue(['profile1', 'profile2']);
  });

  it('should display profile configuration with masked sensitive values', async () => {
    // Setup mock profile config
    const mockConfig = {
      GLIA_SITE_ID: 'site-123',
      GLIA_KEY_ID: 'key-456',
      GLIA_KEY_SECRET: 'super-secret-key-value',
      GLIA_API_URL: 'https://api.glia.com'
    };

    getProfileConfig.mockReturnValue(mockConfig);

    // Mock console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Call the command
    const result = await viewProfileCommand({ name: 'profile1' });

    // Check that getProfileConfig was called
    expect(getProfileConfig).toHaveBeenCalledWith('profile1');

    // Check that success message was shown
    expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('profile1'));

    // Check that console.log was called (displaying the config)
    expect(consoleSpy).toHaveBeenCalled();

    // Check result
    expect(result).toEqual({
      success: true,
      profileName: 'profile1',
      config: mockConfig,
      isEmpty: false
    });

    consoleSpy.mockRestore();
  });

  it('should show unmasked values when showSecrets is true', async () => {
    // Setup mock profile config
    const mockConfig = {
      GLIA_KEY_SECRET: 'super-secret-key-value'
    };

    getProfileConfig.mockReturnValue(mockConfig);

    // Mock console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Call the command with showSecrets
    await viewProfileCommand({ name: 'profile1', showSecrets: true });

    // Check that the console.log was called with unmasked value
    const logCalls = consoleSpy.mock.calls.map(call => call.join(' '));
    const hasUnmaskedSecret = logCalls.some(call => call.includes('super-secret-key-value'));
    expect(hasUnmaskedSecret).toBe(true);

    consoleSpy.mockRestore();
  });

  it('should handle empty profile configuration', async () => {
    // Setup empty config
    getProfileConfig.mockReturnValue({});

    // Call the command
    const result = await viewProfileCommand({ name: 'profile1' });

    // Check that warning was shown
    expect(showWarning).toHaveBeenCalledWith(expect.stringContaining('no configuration set'));

    // Check result
    expect(result).toEqual({
      success: true,
      profileName: 'profile1',
      config: {},
      isEmpty: true
    });
  });

  it('should handle missing profile name', async () => {
    // Call the command with no profile name
    await expect(viewProfileCommand({}))
      .rejects.toThrow('Profile name is required');

    // Check that error was shown
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Profile name is required'));

    // Check that getProfileConfig was not called
    expect(getProfileConfig).not.toHaveBeenCalled();
  });

  it('should handle non-existent profile', async () => {
    // Setup error for non-existent profile
    const errorMessage = `Profile 'invalid' does not exist`;
    getProfileConfig.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    // Mock listProfiles to not include the invalid profile
    listProfiles.mockReturnValue(['profile1', 'profile2']);

    // Call the command with invalid profile
    await expect(viewProfileCommand({ name: 'invalid' }))
      .rejects.toThrow(errorMessage);

    // Check that error was shown
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Failed to view profile'));
  });

  it('should display default profile when specified', async () => {
    // Setup mock profile config for default
    const mockConfig = {
      GLIA_SITE_ID: 'default-site-123'
    };

    getProfileConfig.mockReturnValue(mockConfig);

    // Call the command for default profile
    const result = await viewProfileCommand({ name: 'default' });

    // Check that getProfileConfig was called
    expect(getProfileConfig).toHaveBeenCalledWith('default');

    // Check result
    expect(result).toEqual({
      success: true,
      profileName: 'default',
      config: mockConfig,
      isEmpty: false
    });
  });

  it('should mask sensitive values correctly', async () => {
    // Setup mock profile config with various sensitive values
    const mockConfig = {
      GLIA_KEY_SECRET: 'short',
      GLIA_BEARER_TOKEN: 'very-long-bearer-token-value-here'
    };

    getProfileConfig.mockReturnValue(mockConfig);

    // Mock console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Call the command
    await viewProfileCommand({ name: 'profile1' });

    // Check that console.log was called and values were masked
    const logCalls = consoleSpy.mock.calls.map(call => call.join(' '));
    const hasUnmaskedShort = logCalls.some(call => call.includes('short') && !call.includes('*'));
    const hasUnmaskedLong = logCalls.some(call => call.includes('very-long-bearer-token-value-here'));

    // These should be masked, so we shouldn't find the raw values
    expect(hasUnmaskedShort).toBe(false);
    expect(hasUnmaskedLong).toBe(false);

    // But we should have some masked output
    const hasMaskedOutput = logCalls.some(call => call.includes('*'));
    expect(hasMaskedOutput).toBe(true);

    consoleSpy.mockRestore();
  });

  it('should mask GLIA_KEY_ID partially', async () => {
    // Setup mock profile config with Key ID
    const mockConfig = {
      GLIA_KEY_ID: 'key-12345678-abcdefgh'
    };

    getProfileConfig.mockReturnValue(mockConfig);

    // Mock console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Call the command
    await viewProfileCommand({ name: 'profile1' });

    // Check that console.log was called and Key ID is partially masked
    const logCalls = consoleSpy.mock.calls.map(call => call.join(' '));

    // Should show first 8 chars and mask the rest
    const hasPartialKeyId = logCalls.some(call => call.includes('key-1234') && call.includes('*'));
    expect(hasPartialKeyId).toBe(true);

    // Should not show the full unmasked key
    const hasFullKeyId = logCalls.some(call => call.includes('key-12345678-abcdefgh') && !call.includes('*'));
    expect(hasFullKeyId).toBe(false);

    consoleSpy.mockRestore();
  });

  it('should decode and display GLIA_TOKEN_EXPIRES_AT timestamp', async () => {
    // Setup mock profile config with expiration timestamp
    const timestamp = 1735776000; // 2025-01-02 00:00:00 UTC
    const mockConfig = {
      GLIA_TOKEN_EXPIRES_AT: timestamp.toString()
    };

    getProfileConfig.mockReturnValue(mockConfig);

    // Mock console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Call the command
    await viewProfileCommand({ name: 'profile1' });

    // Check that console.log was called and timestamp is decoded
    const logCalls = consoleSpy.mock.calls.map(call => call.join(' '));

    // Should show the timestamp and the decoded UTC date
    const hasDecodedTimestamp = logCalls.some(call =>
      call.includes(timestamp.toString()) && call.includes('UTC')
    );
    expect(hasDecodedTimestamp).toBe(true);

    // Should include the year 2025 in the decoded timestamp
    const hasCorrectYear = logCalls.some(call => call.includes('2025'));
    expect(hasCorrectYear).toBe(true);

    consoleSpy.mockRestore();
  });

  it('should truncate bearer token to first 12 chars', async () => {
    // Setup mock profile config with long bearer token
    const mockConfig = {
      GLIA_BEARER_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ'
    };

    getProfileConfig.mockReturnValue(mockConfig);

    // Mock console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Call the command
    await viewProfileCommand({ name: 'profile1' });

    // Check that console.log was called and token is truncated
    const logCalls = consoleSpy.mock.calls.map(call => call.join(' '));

    // Should show first 12 chars
    const hasFirstChars = logCalls.some(call => call.includes('eyJhbGciOiJI'));
    expect(hasFirstChars).toBe(true);

    // Should not show the full token
    const hasFullToken = logCalls.some(call =>
      call.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ') &&
      !call.includes('*')
    );
    expect(hasFullToken).toBe(false);

    consoleSpy.mockRestore();
  });
});
