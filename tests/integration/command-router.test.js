import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Mock specifiers resolve relative to tests/setup/setupTests.js, not this file.
// See the note at the bottom of that file.
jest.unstable_mockModule('../../src/commands/index.js', () => ({
  __esModule: true,
  listFunctions: jest.fn().mockResolvedValue({ functions: [] }),
  createFunction: jest.fn().mockResolvedValue({ id: 'new-function-id' }),
  fetchLogs: jest.fn().mockResolvedValue({ logs: [] }),
  invokeFunction: jest.fn().mockResolvedValue({ result: 'success' }),
  createAndDeployVersion: jest.fn().mockResolvedValue({ id: 'new-version-id' })
}));

jest.unstable_mockModule('../../src/cli/error-handler.js', () => ({
  __esModule: true,
  handleError: jest.fn()
}));

jest.unstable_mockModule('../../src/lib/config.js', () => ({
  __esModule: true,
  refreshBearerTokenIfNeeded: jest.fn().mockResolvedValue(false)
}));

const { routeCommand } = await import('../../src/cli/command-router.js');
const commands = await import('../../src/commands/index.js');
const { handleError } = await import('../../src/cli/error-handler.js');

// Mock process.exit to prevent test termination
const originalExit = process.exit;

describe('Command Router Integration', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock process.exit
    process.exit = jest.fn();
  });
  
  afterAll(() => {
    // Restore process.exit
    process.exit = originalExit;
  });

  it('should route list-functions command correctly', async () => {
    const options = { detailed: true };
    await routeCommand('list-functions', options);
    
    expect(commands.listFunctions).toHaveBeenCalledWith(options);
    expect(commands.createFunction).not.toHaveBeenCalled();
    expect(commands.fetchLogs).not.toHaveBeenCalled();
    expect(commands.invokeFunction).not.toHaveBeenCalled();
    expect(commands.createAndDeployVersion).not.toHaveBeenCalled();
  });
  
  it('should route create-function command correctly', async () => {
    const options = { name: 'New Function', description: 'Test description' };
    await routeCommand('create-function', options);
    
    expect(commands.createFunction).toHaveBeenCalledWith(options);
    expect(commands.listFunctions).not.toHaveBeenCalled();
    expect(commands.fetchLogs).not.toHaveBeenCalled();
    expect(commands.invokeFunction).not.toHaveBeenCalled();
    expect(commands.createAndDeployVersion).not.toHaveBeenCalled();
  });
  
  it('should route fetch-logs command correctly', async () => {
    const options = { functionId: 'test-function-id' };
    await routeCommand('fetch-logs', options);
    
    expect(commands.fetchLogs).toHaveBeenCalledWith(options);
    expect(commands.listFunctions).not.toHaveBeenCalled();
    expect(commands.createFunction).not.toHaveBeenCalled();
    expect(commands.invokeFunction).not.toHaveBeenCalled();
    expect(commands.createAndDeployVersion).not.toHaveBeenCalled();
  });
  
  it('should route invoke-function command correctly', async () => {
    const options = { functionId: 'test-function-id', payload: '{"test": true}' };
    await routeCommand('invoke-function', options);
    
    expect(commands.invokeFunction).toHaveBeenCalledWith(options);
    expect(commands.listFunctions).not.toHaveBeenCalled();
    expect(commands.createFunction).not.toHaveBeenCalled();
    expect(commands.fetchLogs).not.toHaveBeenCalled();
    expect(commands.createAndDeployVersion).not.toHaveBeenCalled();
  });
  
  it('should route create-and-deploy-version command correctly', async () => {
    const options = { id: 'test-function-id', path: './function.js' };
    await routeCommand('create-and-deploy-version', options);
    
    expect(commands.createAndDeployVersion).toHaveBeenCalledWith(options);
    expect(commands.listFunctions).not.toHaveBeenCalled();
    expect(commands.createFunction).not.toHaveBeenCalled();
    expect(commands.fetchLogs).not.toHaveBeenCalled();
    expect(commands.invokeFunction).not.toHaveBeenCalled();
  });
  
  it('should route deploy command as an alias for create-and-deploy-version', async () => {
    const options = { id: 'test-function-id', path: './function.js' };
    await routeCommand('deploy', options);
    
    expect(commands.createAndDeployVersion).toHaveBeenCalledWith(options);
    expect(commands.listFunctions).not.toHaveBeenCalled();
    expect(commands.createFunction).not.toHaveBeenCalled();
    expect(commands.fetchLogs).not.toHaveBeenCalled();
    expect(commands.invokeFunction).not.toHaveBeenCalled();
  });
  
  // routeCommand reports the error and returns { success: false, error } so the
  // caller decides whether to exit; it does not call process.exit itself.
  it('should handle unknown commands', async () => {
    const result = await routeCommand('unknown-command');
    
    expect(handleError).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('Unknown command');
  });
  
  it('should handle command execution errors', async () => {
    const testError = new Error('Command execution failed');
    commands.listFunctions.mockRejectedValueOnce(testError);
    
    const result = await routeCommand('list-functions');
    
    expect(handleError).toHaveBeenCalledWith(testError);
    expect(result).toEqual({ success: false, error: testError });
  });
  
  it('should propagate errors when error handling is disabled', async () => {
    const testError = new Error('Command execution failed');
    commands.listFunctions.mockRejectedValueOnce(testError);
    
    await expect(routeCommand('list-functions', {}, false)).rejects.toThrow(testError);
  });
});
