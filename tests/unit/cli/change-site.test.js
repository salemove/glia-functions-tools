import { jest } from '@jest/globals';
import { select, confirm } from '@inquirer/prompts';

// Mock modules and dependencies
jest.mock('@inquirer/prompts');
jest.mock('../../../src/lib/config.js');
jest.mock('../../../src/cli/error-handler.js');

// Mock process.env and process.argv for verbosity checks
const originalEnv = process.env;
const originalArgv = process.argv;

// Import the mocked modules
import {
  loadConfig,
  updateGlobalConfig,
  updateProfile
} from '../../../src/lib/config.js';
import { showSuccess, showInfo, showWarning, showError } from '../../../src/cli/error-handler.js';

// Import the CLI file - note we need to get the export of CLI functions
// but can't import the specific function directly since it's not exported
const mockCLIModule = {};

describe('CLIChangeSite function', () => {
  // Mocks for test
  const mockToken = 'test-token';
  const mockConfig = {
    bearerToken: mockToken,
    keyId: 'test-key-id',
    keySecret: 'test-key-secret',
    siteId: 'current-site-id',
    apiUrl: 'https://test-api.glia.com'
  };
  
  // Mock fetch response with site data
  const mockSites = {
    sites: [
      { id: 'site-1', name: 'Site One' },
      { id: 'site-2', name: 'Site Two' },
      { id: 'current-site-id', name: 'Current Site' }
    ]
  };
  
  // Setup and teardown
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up process.env
    process.env = {
      ...originalEnv,
      GLIA_PROFILE: 'test-profile',
      GLIA_SITE_ID: 'current-site-id',
    };
    
    // Reset process.argv to original state
    process.argv = [...originalArgv];
    
    // Mock config loading
    loadConfig.mockResolvedValue(mockConfig);
    
    // Mock fetch
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/sites')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSites)
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
    
    // Mock select and confirm
    select.mockResolvedValue('site-2');
    confirm.mockResolvedValue(true);
  });
  
  afterEach(() => {
    // Reset process.env to original state
    process.env = originalEnv;
    process.argv = originalArgv;
  });
  
  // We can't directly test the CLIChangeSite function since it's not exported,
  // but we can simulate its behavior and verify the expected interactions
  
  test('should fetch available sites and update selected site', async () => {
    // Import the full file to access the internals
    // Note: This will trigger the CLI initialization but not run it
    await import('../../../src/cli/index.js');
    
    // Verify fetch was called with correct parameters
    expect(fetch).toHaveBeenCalledWith(
      'https://test-api.glia.com/sites', 
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${mockToken}`
        })
      })
    );
    
    // Verify user was prompted to select a site
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Select site to use:',
        choices: expect.arrayContaining([
          expect.objectContaining({
            value: 'site-1'
          }),
          expect.objectContaining({
            value: 'site-2'
          }),
          expect.objectContaining({
            value: 'current-site-id',
            disabled: true
          })
        ])
      })
    );
    
    // Verify profile was updated with new site ID
    expect(updateProfile).toHaveBeenCalledWith('test-profile', {
      'GLIA_SITE_ID': 'site-2'
    });
    
    // Verify success message was shown
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('site-2')
    );
  });
  
  test('should handle errors gracefully when no sites are available', async () => {
    // Mock fetch to return empty sites array
    global.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sites: [] })
      });
    });
    
    // Import the module to trigger function execution
    await import('../../../src/cli/index.js');
    
    // Should show warning about no sites
    expect(showWarning).toHaveBeenCalledWith(
      expect.stringContaining('does not have access to any sites')
    );
  });
  
  test('should handle API errors gracefully', async () => {
    // Mock fetch to return error
    global.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });
    });
    
    // Import the module to trigger function execution
    await import('../../../src/cli/index.js');
    
    // Should show error message
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch available sites')
    );
  });
});