import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Mock external dependencies
jest.mock('../../../../src/lib/config.js', () => ({
  getApiConfig: jest.fn().mockResolvedValue({
    apiUrl: 'https://api.glia.com',
    siteId: 'test-site-id',
    bearerToken: 'test-bearer-token'
  })
}));

jest.mock('../../../../src/lib/api.js', () => {
  return jest.fn().mockImplementation(() => ({
    createApplet: jest.fn().mockResolvedValue({
      id: 'test-applet-id',
      name: 'Test Applet',
      scope: 'engagement'
    })
  }));
});

jest.mock('../../../../src/utils/applet-template-manager.js', () => ({
  createAppletFromTemplate: jest.fn().mockResolvedValue({
    template: 'basic-html',
    outputDir: './test-output',
    files: ['./test-output/applet.html', './test-output/function.js']
  }),
  listAppletTemplates: jest.fn().mockResolvedValue([
    {
      name: 'basic-html',
      displayName: 'Basic HTML Applet',
      description: 'Simple HTML applet template'
    },
    {
      name: 'react-app',
      displayName: 'React Applet',
      description: 'React-based applet template'
    }
  ]),
  validateTemplateVariables: jest.fn().mockResolvedValue({ isValid: true })
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('<html>Test Applet</html>')
}));

// Import the module under test
import { createApplet } from '../../../../src/commands/applets/createApplet.js';

describe('createApplet', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should list templates when listTemplates option is specified', async () => {
    // Call with listTemplates option
    const result = await createApplet({ listTemplates: true });
    
    // Verify the listAppletTemplates function was called
    const { listAppletTemplates } = require('../../../../src/utils/applet-template-manager.js');
    expect(listAppletTemplates).toHaveBeenCalled();
    
    // Verify the result contains the templates
    expect(result).toHaveProperty('templates');
    expect(Array.isArray(result.templates)).toBe(true);
  });
  
  it('should create applet from template without deploying', async () => {
    // Call with required options but without deploy flag
    const options = {
      name: 'Test Applet',
      template: 'basic-html',
      output: './test-output'
    };
    
    const result = await createApplet(options);
    
    // Verify the createAppletFromTemplate function was called with right arguments
    const { createAppletFromTemplate } = require('../../../../src/utils/applet-template-manager.js');
    expect(createAppletFromTemplate).toHaveBeenCalledWith(
      'basic-html',
      './test-output',
      expect.objectContaining({
        appletName: 'Test Applet'
      })
    );
    
    // Verify GliaApiClient.createApplet was NOT called
    const GliaApiClient = require('../../../../src/lib/api.js');
    const apiInstance = GliaApiClient();
    expect(apiInstance.createApplet).not.toHaveBeenCalled();
    
    // Verify the result contains expected properties
    expect(result).toHaveProperty('outputDir', './test-output');
    expect(result).toHaveProperty('files');
  });
  
  it('should create and deploy applet when deploy flag is specified', async () => {
    // Call with required options and deploy flag
    const options = {
      name: 'Test Applet',
      template: 'basic-html',
      output: './test-output',
      deploy: true,
      ownerSiteId: 'test-site-id'
    };
    
    const result = await createApplet(options);
    
    // Verify the createAppletFromTemplate function was called
    const { createAppletFromTemplate } = require('../../../../src/utils/applet-template-manager.js');
    expect(createAppletFromTemplate).toHaveBeenCalled();
    
    // Verify GliaApiClient.createApplet was called with right arguments
    const GliaApiClient = require('../../../../src/lib/api.js');
    const apiInstance = GliaApiClient();
    expect(apiInstance.createApplet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Applet',
        ownerSiteId: 'test-site-id',
        source: '<html>Test Applet</html>'
      })
    );
    
    // Verify the result contains the applet from API
    expect(result).toHaveProperty('applet');
    expect(result.applet).toHaveProperty('id', 'test-applet-id');
  });
  
  it('should validate template name', async () => {
    // Mock the listAppletTemplates function to return a list that doesn't include the requested template
    require('../../../../src/utils/applet-template-manager.js').listAppletTemplates.mockResolvedValueOnce([
      { name: 'template1' }
    ]);
    
    // Call with invalid template name
    const options = {
      name: 'Test Applet',
      template: 'non-existent-template',
      output: './test-output'
    };
    
    // Expect an error to be thrown
    await expect(createApplet(options)).rejects.toThrow('Template "non-existent-template" not found');
  });
  
  it('should require a template name', async () => {
    // Call without template name
    const options = {
      name: 'Test Applet',
      output: './test-output'
    };
    
    // Expect an error to be thrown
    await expect(createApplet(options)).rejects.toThrow('Template name is required');
  });
  
  it('should validate template variables', async () => {
    // Mock validateTemplateVariables to fail
    require('../../../../src/utils/applet-template-manager.js').validateTemplateVariables.mockResolvedValueOnce({
      isValid: false,
      message: 'Missing required variables: appletName'
    });
    
    // Call with options that don't meet template requirements
    const options = {
      name: '', // Empty name will fail validation
      template: 'basic-html',
      output: './test-output'
    };
    
    // Expect an error to be thrown
    await expect(createApplet(options)).rejects.toThrow('Invalid template variables');
  });
  
  it('should require ownerSiteId for deployment', async () => {
    // Call with deploy flag but without ownerSiteId
    const options = {
      name: 'Test Applet',
      template: 'basic-html',
      output: './test-output',
      deploy: true
    };
    
    // Expect an error to be thrown
    await expect(createApplet(options)).rejects.toThrow('Owner site ID is required for deployment');
  });
});