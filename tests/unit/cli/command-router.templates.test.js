import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Mock dependencies
// Mock specifiers resolve relative to tests/setup/setupTests.js, not this
// file. See the note at the bottom of that file.
jest.unstable_mockModule('../../src/lib/config.js', () => ({
  refreshBearerTokenIfNeeded: jest.fn().mockResolvedValue(false)
}));

jest.unstable_mockModule('../../src/commands/index.js', () => ({
  templates: jest.fn().mockResolvedValue({ success: true })
}));

// Import the module under test after the mocks are registered.
const { routeCommand } = await import('../../../src/cli/command-router.js');
const { templates } = await import('../../../src/commands/index.js');

describe('command-router with templates command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should route the templates command correctly', async () => {
    // Arrange
    const options = { 
      list: true, 
      type: 'function' 
    };
    
    // Act
    const result = await routeCommand('templates', options);
    
    // Assert
    expect(templates).toHaveBeenCalledWith(options);
    expect(result).toEqual({ success: true });
  });
});