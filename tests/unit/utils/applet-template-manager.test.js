/**
 * Tests for the applet template manager.
 *
 * These run against the applet templates that actually ship in
 * src/templates/applets, writing into a temporary output directory. The previous
 * version mocked `node:fs` and `node:path` wholesale, which cannot work under
 * ESM and, even if it had, only asserted that the mocks were called.
 *
 * Testing the real templates is also worth more: it catches a template.json
 * that stops parsing or a `files` entry that points at a file that is not there.
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  listAppletTemplates,
  getAppletTemplate,
  createAppletFromTemplate,
  getAppletTemplateEnvVars,
  validateTemplateVariables
} from '../../../src/utils/applet-template-manager.js';

describe('appletTemplateManager', () => {
  let outputDir;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glia-applet-test-'));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  describe('listAppletTemplates', () => {
    it('should list the shipped applet templates', async () => {
      const templates = await listAppletTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.map(t => t.name)).toContain('basic-html');
    });

    it('should return templates with the metadata the CLI renders', async () => {
      const templates = await listAppletTemplates();

      for (const template of templates) {
        expect(typeof template.name).toBe('string');
        expect(typeof template.displayName).toBe('string');
        expect(typeof template.description).toBe('string');
      }
    });
  });

  describe('getAppletTemplate', () => {
    it('should return a template by name', async () => {
      const template = await getAppletTemplate('basic-html');

      expect(template.name).toBe('basic-html');
      // This manager returns { name, metadata }; the file list lives on metadata.
      expect(Array.isArray(template.metadata.files)).toBe(true);
      expect(template.metadata.files.length).toBeGreaterThan(0);
    });

    it('should throw if the template does not exist', async () => {
      await expect(getAppletTemplate('no-such-template')).rejects.toThrow();
    });
  });

  describe('createAppletFromTemplate', () => {
    it('should write every declared file and substitute variables', async () => {
      const result = await createAppletFromTemplate('basic-html', outputDir, {
        appletName: 'My Test Applet',
        description: 'Created by a test',
        authorName: 'Tester'
      });

      expect(result.files.length).toBeGreaterThan(0);

      for (const file of result.files) {
        const target = typeof file === 'string' ? file : file.target ?? file.destination;
        expect(fs.existsSync(target)).toBe(true);
      }

      // The template placeholder must not survive into the generated output.
      const html = fs.readFileSync(path.join(outputDir, 'applet.html'), 'utf8');
      expect(html).not.toContain('{{appletName}}');
      expect(html).toContain('My Test Applet');
    });

    it('should throw for an unknown template', async () => {
      await expect(createAppletFromTemplate('no-such-template', outputDir, {}))
        .rejects.toThrow();
    });
  });

  describe('validateTemplateVariables', () => {
    it('should accept variables that satisfy the template', async () => {
      const result = await validateTemplateVariables('basic-html', {
        appletName: 'My Applet'
      });

      // Note the shape: this module reports { isValid, missing, message }, while
      // template-engine.js exports a same-named function returning
      // { valid, errors }. Two managers, two contracts.
      expect(result.isValid).toBe(true);
    });

    it('should reject a missing required variable', async () => {
      const result = await validateTemplateVariables('basic-html', {});

      expect(result.isValid).toBe(false);
      expect(result.missing).toContain('appletName');
    });
  });

  describe('getAppletTemplateEnvVars', () => {
    it('should return an object for a known template', async () => {
      const envVars = await getAppletTemplateEnvVars('basic-html');
      expect(typeof envVars).toBe('object');
    });

    it('should return an empty object for an unknown template', async () => {
      const envVars = await getAppletTemplateEnvVars('no-such-template');
      expect(envVars).toEqual({});
    });
  });
});
