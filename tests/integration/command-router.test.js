import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { routeCommand } from '../../src/cli/command-router.js';
import * as commands from '../../src/commands/index.js';
import { handleError } from '../../src/cli/error-handler.js';

// Mock commands and error handler
jest.mock('../../src/commands/index.js', () => ({
  listFunctions: jest.fn().mockResolvedValue({ functions: [] }),
  createFunction: jest.fn().mockResolvedValue({ id: 'new-function-id' }),
  fetchLogs: jest.fn().mockResolvedValue({ logs: [] }),
  invokeFunction: jest.fn().mockResolvedValue({ result: 'success' }),
  createAndDeployVersion: jest.fn().mockResolvedValue({ id: 'new-version-id' })
}));

jest.mock('../../src/cli/error-handler.js', () => ({
  handleError: jest.fn()
}));

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
  
  it('should handle unknown commands', async () => {
    await routeCommand('unknown-command');
    
    expect(handleError).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });
  
  it('should handle command execution errors', async () => {
    const testError = new Error('Command execution failed');
    commands.listFunctions.mockRejectedValueOnce(testError);
    
    await routeCommand('list-functions');
    
    expect(handleError).toHaveBeenCalledWith(testError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
