/**
 * Unit tests for setupExportHandler command
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import setupExportHandler from '../../../src/commands/exports/setupExportHandler';
import { getExportEventMetadata } from '../../../src/utils/export-events-registry';
import { createFromTemplate } from '../../../src/utils/unified-template-manager';

// Mock dependencies
jest.mock('../../../src/utils/export-events-registry');
jest.mock('../../../src/utils/unified-template-manager');
jest.mock('../../../src/cli/export-wizard', () => ({
  runExportWizard: jest.fn()
}));

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
    expect(getExportEventMetadata).toHaveBeenCalledWith('invalid-event-type');
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
    expect(mockCommand.info).toHaveBeenCalledTimes(5); // Next steps info
  });

  it('should use the wizard in interactive mode', async () => {
    // Import the wizard module
    const { runExportWizard } = require('../../../src/cli/export-wizard');
    
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
    // Import the wizard module
    const { runExportWizard } = require('../../../src/cli/export-wizard');
    
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