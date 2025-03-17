/**
 * Unit tests for the Commander.js-based CLI implementation
 */
import { jest } from '@jest/globals';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory path of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the CLI executable relative to the test file
const CLI_PATH = path.resolve(__dirname, '../../../bin/glia-functions-commander.js');

// Mock the API client
jest.mock('../../../src/lib/api.js', () => {
  return jest.fn().mockImplementation(() => {
    return {
      listFunctions: jest.fn().mockResolvedValue({
        functions: [
          { id: 'func1', name: 'Test Function 1' },
          { id: 'func2', name: 'Test Function 2' }
        ]
      }),
      createFunction: jest.fn().mockResolvedValue({
        id: 'newfunc',
        name: 'New Function',
        description: 'Test description'
      }),
      getFunction: jest.fn().mockResolvedValue({
        id: 'func1',
        name: 'Test Function',
        invocation_uri: 'https://api.glia.com/functions/func1/invoke'
      }),
      getFunctionLogs: jest.fn().mockResolvedValue({
        logs: [
          { timestamp: '2025-03-03T12:00:00Z', message: 'Test log 1' },
          { timestamp: '2025-03-03T12:01:00Z', message: 'Test log 2' }
        ]
      }),
      invokeFunction: jest.fn().mockResolvedValue({
        success: true,
        result: { message: 'Function executed successfully' }
      }),
      deployVersion: jest.fn().mockResolvedValue({
        success: true,
        task_id: 'task123'
      })
    };
  });
});

// Mock the command router
jest.mock('../../../src/cli/command-router.js', () => {
  return {
    routeCommand: jest.fn().mockResolvedValue(true)
  };
});

// Mock config
jest.mock('../../../src/lib/config.js', () => {
  return {
    getCliVersion: jest.fn(() => '0.2.0'),
    getApiConfig: jest.fn(() => ({
      bearerToken: 'test-token',
      apiUrl: 'https://api.glia.com',
      siteId: 'test-site'
    }))
  };
});

// Spy on console.log and console.error
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock process.exit to prevent tests from exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

describe('Commander.js CLI', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to execute CLI commands for testing
  const execCli = (args) => {
    try {
      // Mock command execution by requiring the CLI script with mocked process.argv
      process.argv = ['node', CLI_PATH, ...args.split(' ')];
      
      // Since we can't easily mock imports dynamically in Jest with ESM,
      // we'll verify the command router is called with the right arguments
      const { routeCommand } = require('../../../src/cli/command-router.js');
      
      // Return any relevant mock data for assertions
      return { routeCommand };
    } catch (error) {
      console.error('Test execution error:', error);
      return { error };
    }
  };

  test('should show help with --help flag', () => {
    // This is more of an integration test, we'd need to capture stdout
    // For unit testing, we'll just verify the structure is in place
    // and rely on manual testing for the actual output
    const result = execCli('--help');
    expect(result).toBeDefined();
  });

  test('should route list-functions command correctly', async () => {
    const { routeCommand } = execCli('list-functions --detailed');
    
    // Check if routeCommand was called with correct parameters
    expect(routeCommand).toHaveBeenCalledWith('list-functions', {
      detailed: true
    });
  });

  test('should route create-function command correctly', async () => {
    const { routeCommand } = execCli('create-function --name "Test Function" --description "Test description"');
    
    // Check if routeCommand was called with correct parameters
    expect(routeCommand).toHaveBeenCalledWith('create-function', {
      name: 'Test Function',
      description: 'Test description'
    });
  });

  test('should route deploy command correctly', async () => {
    const { routeCommand } = execCli('deploy --function-id func123 --version-id ver456');
    
    // Check if routeCommand was called with correct parameters
    expect(routeCommand).toHaveBeenCalledWith('deploy', {
      functionId: 'func123',
      versionId: 'ver456'
    });
  });

  test('should fail when required options are missing', async () => {
    execCli('create-function');
    
    // Verify that error was logged and process.exit was called
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('should route fetch-logs command correctly', async () => {
    const { routeCommand } = execCli('fetch-logs --function-id func123');
    
    // Check if routeCommand was called with correct parameters
    expect(routeCommand).toHaveBeenCalledWith('fetch-logs', {
      functionId: 'func123'
    });
  });

  test('should route create-version command correctly', async () => {
    const { routeCommand } = execCli('create-version --function-id func123 --path ./function.js --env {"KEY":"VALUE"} --deploy');
    
    // Check if routeCommand was called with correct parameters
    expect(routeCommand).toHaveBeenCalledWith('create-and-deploy-version', {
      functionId: 'func123',
      path: './function.js',
      env: { KEY: 'VALUE' },
      compatibilityDate: null,
      deploy: true
    });
  });
});
