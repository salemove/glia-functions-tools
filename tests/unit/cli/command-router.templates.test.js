import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Mock dependencies
jest.mock('../../../src/lib/config.js', () => ({
  refreshBearerTokenIfNeeded: jest.fn().mockResolvedValue(false)
}));

jest.mock('../../../src/commands/index.js', () => ({
  templates: jest.fn().mockResolvedValue({ success: true })
}));

// Import the module under test
import { routeCommand } from '../../../src/cli/command-router.js';
import { templates } from '../../../src/commands/index.js';

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