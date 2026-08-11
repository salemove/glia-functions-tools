/**
 * Unit tests for the BaseCommand class
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { Command } from 'commander';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

// Mock specifiers resolve relative to tests/setup/setupTests.js, not this
// file. See the note at the bottom of that file. A mock factory must return a
// module namespace, so a default export goes under `default`.
jest.unstable_mockModule('../../src/lib/api.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    listFunctions: jest.fn().mockResolvedValue({ functions: [] }),
    createFunction: jest.fn().mockResolvedValue({ id: 'test-id', name: 'Test Function' })
  }))
}));

jest.unstable_mockModule('../../src/lib/config.js', () => ({
  __esModule: true,
  getApiConfig: jest.fn(async () => ({
    bearerToken: 'test-token',
    apiUrl: 'https://api.glia.com',
    siteId: 'test-site'
  }))
}));

const { BaseCommand } = await import('../../../src/cli/base-command.js');

describe('BaseCommand', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create a command with name and description', () => {
    const command = new BaseCommand('test', 'Test command');
    expect(command.name).toBe('test');
    expect(command.description).toBe('Test command');
    expect(command.command).toBeInstanceOf(Command);
  });

  test('should add an option and return command instance for chaining', () => {
    const command = new BaseCommand('test', 'Test command');
    const result = command.option('--name <name>', 'Name option');
    
    expect(result).toBe(command);
    
    // There's no easy way to check if the option was added to the Command instance,
    // since it doesn't expose the options publicly, but we can verify that the command
    // has been modified by checking that formatHelp() includes the option
    const helpText = command.command.helpInformation();
    expect(helpText).toContain('--name');
    expect(helpText).toContain('Name option');
  });

  test('should add a required option', () => {
    const command = new BaseCommand('test', 'Test command');
    command.requiredOption('--name <name>', 'Name option');
    
    const helpText = command.command.helpInformation();
    expect(helpText).toContain('--name');
    expect(helpText).toContain('Name option');
    // Commander does not annotate required options in help text, so check the
    // option itself rather than the rendered string.
    const option = command.command.options.find(o => o.long === '--name');
    expect(option.mandatory).toBe(true);
  });

  test('should create an API client', async () => {
    const command = new BaseCommand('test', 'Test command');
    const apiClient = await command.createApiClient();
    
    expect(apiClient).toBeDefined();
    expect(apiClient.listFunctions).toBeDefined();
    expect(apiClient.createFunction).toBeDefined();
  });

  test('should format data as JSON', () => {
    const command = new BaseCommand('test', 'Test command');
    const data = { key: 'value', nested: { prop: 123 } };
    
    const formattedJson = command.formatJson(data);
    
    expect(formattedJson).toBe(JSON.stringify(data, null, 2));
  });

  test('should format data as a table', () => {
    const command = new BaseCommand('test', 'Test command');
    const data = [
      { id: '1', name: 'Item 1', description: 'First item' },
      { id: '2', name: 'Item 2', description: 'Second item' }
    ];
    
    const table = command.formatTable(data);
    
    // Table should contain headers
    expect(table).toContain('id');
    expect(table).toContain('name');
    expect(table).toContain('description');
    
    // Table should contain data
    expect(table).toContain('Item 1');
    expect(table).toContain('Second item');
  });

  test('should format data as a table with specified columns', () => {
    const command = new BaseCommand('test', 'Test command');
    const data = [
      { id: '1', name: 'Item 1', description: 'First item', extra: 'x1' },
      { id: '2', name: 'Item 2', description: 'Second item', extra: 'x2' }
    ];
    
    const table = command.formatTable(data, ['id', 'name']);
    
    // Table should contain selected headers
    expect(table).toContain('id');
    expect(table).toContain('name');
    
    // Table should not contain unselected headers
    expect(table).not.toContain('description');
    expect(table).not.toContain('extra');
    
    // Table should contain selected data
    expect(table).toContain('Item 1');
    expect(table).toContain('Item 2');
    
    // Table should not contain unselected data
    expect(table).not.toContain('First item');
    expect(table).not.toContain('Second item');
  });

  test('should print success message with green color', () => {
    const command = new BaseCommand('test', 'Test command');
    command.success('Test success');
    
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    const call = mockConsoleLog.mock.calls[0][0];
    expect(call).toContain('✓ Test success');
  });

  test('should print info message with blue color', () => {
    const command = new BaseCommand('test', 'Test command');
    command.info('Test info');
    
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    const call = mockConsoleLog.mock.calls[0][0];
    expect(call).toContain('ℹ Test info');
  });

  test('should print warning message with yellow color', () => {
    const command = new BaseCommand('test', 'Test command');
    command.warning('Test warning');
    
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    const call = mockConsoleLog.mock.calls[0][0];
    expect(call).toContain('⚠ Test warning');
  });

  test('should print error message with red color', () => {
    const command = new BaseCommand('test', 'Test command');
    command.error('Test error');
    
    expect(mockConsoleError).toHaveBeenCalledTimes(1);
    const call = mockConsoleError.mock.calls[0][0];
    expect(call).toContain('✗ Test error');
  });

  test('should handle action with error handling', async () => {
    const command = new BaseCommand('test', 'Test command');
    const mockAction = jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    });
    
    command.action(mockAction);
    
    // Simulate running the action by calling the commander action directly
    // Commander invokes the handler with the parsed positional arguments.
    const commanderAction = command.command._actionHandler;
    await commanderAction([]);
    
    expect(mockAction).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
