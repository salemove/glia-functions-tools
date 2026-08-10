import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Mock specifiers resolve relative to tests/setup/setupTests.js, not this file.
// See the note at the bottom of that file.
//
// The previous version of this file mocked src/utils/applet-template-manager.js
// and reached for it with require(), neither of which matches reality: the
// command imports unified-template-manager.js and template-engine.js, and this
// is an ES module.
jest.unstable_mockModule('../../src/lib/config.js', () => ({
  __esModule: true,
  getApiConfig: jest.fn().mockResolvedValue({
    apiUrl: 'https://api.glia.com',
    siteId: 'test-site-id',
    bearerToken: 'test-bearer-token'
  })
}));

jest.unstable_mockModule('../../src/lib/api.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createApplet: jest.fn().mockResolvedValue({
      id: 'test-applet-id',
      name: 'Test Applet',
      scope: 'engagement'
    })
  }))
}));

jest.unstable_mockModule('../../src/utils/unified-template-manager.js', () => ({
  __esModule: true,
  createAppletFromTemplate: jest.fn().mockResolvedValue({
    files: ['./test-output/applet.html', './test-output/function.js']
  }),
  listAppletTemplates: jest.fn().mockResolvedValue([
    { name: 'basic-html', displayName: 'Basic HTML Applet', description: 'Simple HTML applet template' },
    { name: 'react-app', displayName: 'React Applet', description: 'React-based applet template' }
  ]),
  getTemplate: jest.fn().mockResolvedValue({ name: 'basic-html', variables: {} })
}));

jest.unstable_mockModule('../../src/utils/template-engine.js', () => ({
  __esModule: true,
  validateTemplateVariables: jest.fn().mockReturnValue({ valid: true, errors: [] })
}));

const fsMock = {
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('<html>Test Applet</html>')
};
jest.unstable_mockModule('fs', () => ({ __esModule: true, ...fsMock, default: fsMock }));

const { createApplet } = await import('../../../../src/commands/applets/createApplet.js');
const { createAppletFromTemplate, listAppletTemplates, getTemplate } =
  await import('../../../../src/utils/unified-template-manager.js');
const { validateTemplateVariables } = await import('../../../../src/utils/template-engine.js');

describe('createApplet', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should list templates when listTemplates is specified', async () => {
    const result = await createApplet({ listTemplates: true });

    expect(listAppletTemplates).toHaveBeenCalled();
    expect(Array.isArray(result.templates)).toBe(true);
    expect(result.templates).toHaveLength(2);
  });

  it('should create an applet from a template without deploying', async () => {
    const result = await createApplet({
      name: 'Test Applet',
      template: 'basic-html',
      output: './test-output'
    });

    expect(getTemplate).toHaveBeenCalledWith('basic-html', 'applet');
    expect(createAppletFromTemplate).toHaveBeenCalledWith(
      'basic-html',
      './test-output',
      expect.objectContaining({ appletName: 'Test Applet' })
    );
    expect(result.outputDir).toBe('./test-output');
    expect(result.files).toHaveLength(2);
    // Nothing was deployed, so no applet id came back.
    expect(result.applet).toBeUndefined();
  });

  it('should reject a template name that does not exist', async () => {
    listAppletTemplates.mockResolvedValueOnce([{ name: 'template1' }]);

    await expect(createApplet({
      name: 'Test Applet',
      template: 'non-existent-template',
      output: './test-output'
    })).rejects.toThrow('Template "non-existent-template" not found');
  });

  it('should require a template name', async () => {
    await expect(createApplet({ name: 'Test Applet', output: './test-output' }))
      .rejects.toThrow('Template name is required');
  });

  it('should reject invalid template variables', async () => {
    validateTemplateVariables.mockReturnValueOnce({
      valid: false,
      errors: ['Missing required variable: appletName']
    });

    await expect(createApplet({
      name: 'Test Applet',
      template: 'basic-html',
      output: './test-output'
    })).rejects.toThrow('Invalid template variables');
  });

  it('should require an owner site ID for deployment', async () => {
    await expect(createApplet({
      name: 'Test Applet',
      template: 'basic-html',
      output: './test-output',
      deploy: true
    })).rejects.toThrow('Owner site ID is required');
  });
});
