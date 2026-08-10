/**
 * Unit tests for setupExportHandler command
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
// Mock specifiers resolve relative to tests/setup/setupTests.js, not this
// file. See the note at the bottom of that file.
// Automock does not exist for ESM, so every mocked export is spelled out.
jest.unstable_mockModule('../../src/utils/export-events-registry.js', () => ({
  __esModule: true,
  getExportEventMetadata: jest.fn(),
  getExportEventMetadataSync: jest.fn(),
  getExportEventTypes: jest.fn().mockResolvedValue({}),
  getSchemaPath: jest.fn(),
  getSchemaPathSync: jest.fn(),
  getSamplePayloadPath: jest.fn(),
  getSamplePayloadPathSync: jest.fn(),
  filterEventTypesByTag: jest.fn().mockResolvedValue({}),
  EXPORT_EVENT_TYPES: {}
}));

jest.unstable_mockModule('../../src/utils/unified-template-manager.js', () => ({
  __esModule: true,
  createFromTemplate: jest.fn()
}));

jest.unstable_mockModule('../../src/cli/export-wizard.js', () => ({
  __esModule: true,
  runExportWizard: jest.fn()
}));

const { default: setupExportHandler } =
  await import('../../../src/commands/exports/setupExportHandler.js');
const { getExportEventMetadata } =
  await import('../../../src/utils/export-events-registry.js');
const { createFromTemplate } =
  await import('../../../src/utils/unified-template-manager.js');
const { runExportWizard } = await import('../../../src/cli/export-wizard.js');

// Mock BaseCommand
const mockCommand = {
  info: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

describe('setupExportHandler command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw an error for invalid export event type', async () => {
    // Mock the getExportEventMetadata function to return null
    getExportEventMetadata.mockReturnValue(null);

    // Set up options with an invalid event type
    const options = {
      eventType: 'invalid-event-type',
      interactive: false
    };

    // Test that it throws an error
    await expect(setupExportHandler(options, mockCommand)).rejects.toThrow(
      'Invalid export event type'
    );

    // Verify the error was reported via the command
    expect(mockCommand.error).toHaveBeenCalled();
    expect(getExportEventMetadata).toHaveBeenCalledWith('invalid-event-type', true);
  });

  it('should create an export handler successfully', async () => {
    // Mock the getExportEventMetadata function
    getExportEventMetadata.mockReturnValue({
      displayName: 'Engagement Start',
      templateName: 'export-handler-engagement-start'
    });

    // Mock the createFromTemplate function
    createFromTemplate.mockResolvedValue({
      files: [{ success: true, target: 'function.js' }]
    });

    // Set up options
    const options = {
      eventType: 'engagement-start',
      outputDir: '/tmp/test-dir',
      interactive: false,
      projectName: 'test-handler'
    };

    // Execute the command
    const result = await setupExportHandler(options, mockCommand);

    // Verify the command succeeded
    expect(result.success).toBe(true);
    expect(result.template).toBe('export-handler-engagement-start');
    expect(result.outputDir).toBe('/tmp/test-dir');

    // Verify the template was created with the right parameters
    expect(createFromTemplate).toHaveBeenCalledWith(
      'export-handler-engagement-start',
      '/tmp/test-dir',
      expect.objectContaining({
        variables: expect.objectContaining({
          projectName: 'test-handler',
          eventType: 'engagement-start'
        })
      })
    );

    // Verify success was reported via the command
    expect(mockCommand.success).toHaveBeenCalled();
    // Assert the guidance is printed rather than pinning an exact call count.
    expect(mockCommand.info).toHaveBeenCalledWith('Next steps:');
    expect(mockCommand.info).toHaveBeenCalledWith('5. Deploy: npm run deploy');
  });

  it('should use the wizard in interactive mode', async () => {
    // Mock the wizard to return a specific configuration
    runExportWizard.mockResolvedValue({
      eventType: 'engagement-end',
      projectName: 'wizard-project',
      forwarding: {
        url: 'https://example.com/webhook',
        authType: 'api-key'
      },
      filtering: true,
      typescript: true,
      canceled: false
    });
    
    // Mock the getExportEventMetadata function
    getExportEventMetadata.mockReturnValue({
      displayName: 'Engagement End',
      templateName: 'export-handler-engagement-end'
    });

    // Mock the createFromTemplate function
    createFromTemplate.mockResolvedValue({
      files: [{ success: true, target: 'function.js' }]
    });

    // Set up options with interactive mode
    const options = {
      interactive: true
    };

    // Execute the command
    const result = await setupExportHandler(options, mockCommand);

    // Verify the wizard was called
    expect(runExportWizard).toHaveBeenCalledWith(options);

    // Verify the command succeeded with wizard values
    expect(result.success).toBe(true);
    expect(result.template).toBe('export-handler-engagement-end');
    
    // Verify template was created with values from wizard
    expect(createFromTemplate).toHaveBeenCalledWith(
      'export-handler-engagement-end',
      expect.any(String),
      expect.objectContaining({
        variables: expect.objectContaining({
          projectName: 'wizard-project',
          eventType: 'engagement-end',
          includeForwarding: 'true',
          forwardingUrl: 'https://example.com/webhook',
          authType: 'api-key',
          includeFiltering: 'true',
          includeTypescript: 'true'
        })
      })
    );
  });

  it('should handle wizard cancellation', async () => {
    // Mock the wizard to return a canceled result
    runExportWizard.mockResolvedValue({
      canceled: true
    });

    // Execute the command with interactive mode
    const result = await setupExportHandler({ interactive: true }, mockCommand);

    // Verify that null is returned when canceled
    expect(result).toBeNull();
    expect(mockCommand.info).toHaveBeenCalledWith('Export handler setup canceled');
    expect(createFromTemplate).not.toHaveBeenCalled();
  });
});