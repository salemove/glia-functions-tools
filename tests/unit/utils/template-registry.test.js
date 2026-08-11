/**
 * Tests for the template registry.
 *
 * These build a real template tree in a temporary directory and point the
 * registry at it with setBaseTemplatePaths(). The previous version mocked
 * `node:fs` and `node:path` wholesale and then tried to assign to the module's
 * exported bindings, which is not possible for an ES module — every test in the
 * file failed with "Cannot assign to read only property".
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readTemplateMetadata,
  discoverTemplates,
  readTemplateRegistry,
  getTemplateByName,
  listTemplates,
  resolveTemplateInheritance,
  registerCustomTemplate,
  setBaseTemplatePaths,
  clearTemplateRegistryCache
} from '../../../src/utils/template-registry.js';

let root;
let paths;

/**
 * Write a template directory containing a template.json.
 *
 * @param {string} type - Template root to write into (function, project, ...)
 * @param {string} name - Directory name
 * @param {Object|string} metadata - Object to serialise, or raw file contents
 * @returns {string} Path to the created template directory
 */
function writeTemplate(type, name, metadata) {
  const dir = path.join(paths[type], name);
  fs.mkdirSync(dir, { recursive: true });
  const contents = typeof metadata === 'string' ? metadata : JSON.stringify(metadata, null, 2);
  fs.writeFileSync(path.join(dir, 'template.json'), contents);
  return dir;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'glia-registry-test-'));
  paths = {
    function: path.join(root, 'functions'),
    project: path.join(root, 'projects'),
    applet: path.join(root, 'applets'),
    custom: path.join(root, 'custom')
  };
  for (const dir of Object.values(paths)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  setBaseTemplatePaths(paths);
});

afterEach(() => {
  clearTemplateRegistryCache();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('readTemplateMetadata', () => {
  it('should read and parse template metadata and record its path', async () => {
    const dir = writeTemplate('function', 'basic', {
      name: 'basic',
      displayName: 'Basic Function',
      description: 'A basic function template',
      type: 'function'
    });

    const metadata = await readTemplateMetadata(dir);

    expect(metadata.name).toBe('basic');
    expect(metadata.displayName).toBe('Basic Function');
    expect(metadata.path).toBe(dir);
  });

  it('should return null when template.json is missing', async () => {
    const dir = path.join(paths.function, 'no-metadata');
    fs.mkdirSync(dir, { recursive: true });

    expect(await readTemplateMetadata(dir)).toBeNull();
  });

  it('should return null for invalid JSON', async () => {
    const dir = writeTemplate('function', 'broken', '{ not json');

    expect(await readTemplateMetadata(dir)).toBeNull();
  });

  it('should return null when required fields are missing', async () => {
    const dir = writeTemplate('function', 'nameless', { displayName: 'No name' });

    expect(await readTemplateMetadata(dir)).toBeNull();
  });
});

describe('discoverTemplates', () => {
  it('should discover every template directory', async () => {
    writeTemplate('function', 'one', { name: 'one', displayName: 'One', description: 'd' });
    writeTemplate('function', 'two', { name: 'two', displayName: 'Two', description: 'd' });

    const templates = await discoverTemplates(paths.function, 'function');

    expect(templates.map(t => t.name).sort()).toEqual(['one', 'two']);
  });

  it('should skip entries that are not directories', async () => {
    writeTemplate('function', 'one', { name: 'one', displayName: 'One', description: 'd' });
    fs.writeFileSync(path.join(paths.function, 'stray.txt'), 'not a template');

    const templates = await discoverTemplates(paths.function, 'function');

    expect(templates).toHaveLength(1);
  });

  it('should return an empty array for a missing directory', async () => {
    expect(await discoverTemplates(path.join(root, 'nope'), 'function')).toEqual([]);
  });

  it('should apply the provided type when the template declares none', async () => {
    writeTemplate('project', 'untyped', { name: 'untyped', displayName: 'U', description: 'd' });

    const templates = await discoverTemplates(paths.project, 'project');

    expect(templates[0].type).toBe('project');
  });
});

describe('readTemplateRegistry', () => {
  it('should index templates by name, type and tag', async () => {
    writeTemplate('function', 'basic', {
      name: 'basic', displayName: 'Basic', description: 'd', tags: ['starter', 'function']
    });
    writeTemplate('project', 'api', {
      name: 'api', displayName: 'API', description: 'd', tags: ['starter']
    });

    const registry = await readTemplateRegistry(true);

    expect(registry.templates).toHaveLength(2);
    expect(registry.byName.basic.displayName).toBe('Basic');
    expect(registry.byType.function.map(t => t.name)).toEqual(['basic']);
    expect(registry.byType.project.map(t => t.name)).toEqual(['api']);
    expect(registry.byTag.starter.map(t => t.name).sort()).toEqual(['api', 'basic']);
  });

  it('should return the cached registry until a refresh is forced', async () => {
    writeTemplate('function', 'first', { name: 'first', displayName: 'F', description: 'd' });
    const first = await readTemplateRegistry(true);
    expect(first.templates).toHaveLength(1);

    writeTemplate('function', 'second', { name: 'second', displayName: 'S', description: 'd' });

    // Without a refresh the new template is invisible.
    expect((await readTemplateRegistry()).templates).toHaveLength(1);
    expect((await readTemplateRegistry(true)).templates).toHaveLength(2);
  });

  it('should tolerate templates without tags', async () => {
    writeTemplate('function', 'untagged', { name: 'untagged', displayName: 'U', description: 'd' });

    const registry = await readTemplateRegistry(true);

    expect(registry.byName.untagged).toBeDefined();
    expect(registry.byTag).toEqual({});
  });
});

describe('getTemplateByName', () => {
  it('should return a template by name', async () => {
    writeTemplate('function', 'basic', { name: 'basic', displayName: 'Basic', description: 'd' });

    const template = await getTemplateByName('basic', true);

    expect(template.name).toBe('basic');
  });

  it('should return null for an unknown name', async () => {
    expect(await getTemplateByName('missing', true)).toBeNull();
  });

  it('should resolve inheritance when asked', async () => {
    writeTemplate('function', 'parent', {
      name: 'parent',
      displayName: 'Parent',
      description: 'd',
      variables: { a: { description: 'a' } },
      tags: ['base']
    });
    writeTemplate('function', 'child', {
      name: 'child',
      displayName: 'Child',
      description: 'd',
      extends: 'parent',
      variables: { b: { description: 'b' } },
      tags: ['child']
    });

    const unresolved = await getTemplateByName('child', true, false);
    expect(unresolved.variables).toEqual({ b: { description: 'b' } });

    const resolved = await getTemplateByName('child', true, true);
    expect(Object.keys(resolved.variables).sort()).toEqual(['a', 'b']);
    expect(resolved.tags.sort()).toEqual(['base', 'child']);
    expect(resolved._resolved).toBe(true);
  });
});

describe('listTemplates', () => {
  beforeEach(async () => {
    writeTemplate('function', 'basic', {
      name: 'basic', displayName: 'Basic Function', description: 'A simple starter', tags: ['starter']
    });
    writeTemplate('function', 'ai', {
      name: 'ai', displayName: 'AI Integration', description: 'Talks to a model', tags: ['ai']
    });
    writeTemplate('project', 'api', {
      name: 'api', displayName: 'API Project', description: 'Calls an API', tags: ['starter', 'api']
    });
    await readTemplateRegistry(true);
  });

  it('should list every template when unfiltered', async () => {
    expect(await listTemplates()).toHaveLength(3);
  });

  it('should filter by type', async () => {
    const templates = await listTemplates({ type: 'function' });
    expect(templates.map(t => t.name).sort()).toEqual(['ai', 'basic']);
  });

  it('should filter by tag', async () => {
    const templates = await listTemplates({ tag: 'starter' });
    expect(templates.map(t => t.name).sort()).toEqual(['api', 'basic']);
  });

  it('should filter by search term across name, display name and description', async () => {
    expect((await listTemplates({ search: 'model' })).map(t => t.name)).toEqual(['ai']);
    expect((await listTemplates({ search: 'API' })).map(t => t.name).sort()).toEqual(['api']);
  });

  it('should combine filters', async () => {
    const templates = await listTemplates({ type: 'function', tag: 'starter' });
    expect(templates.map(t => t.name)).toEqual(['basic']);
  });

  it('should return an empty array when nothing matches', async () => {
    expect(await listTemplates({ search: 'nothing-matches-this' })).toEqual([]);
  });
});

describe('resolveTemplateInheritance', () => {
  it('should return the template unchanged when it extends nothing', async () => {
    const template = { name: 'solo', displayName: 'Solo', description: 'd' };
    expect(await resolveTemplateInheritance(template)).toBe(template);
  });

  it('should merge files, dependencies and variables from the parent', async () => {
    writeTemplate('function', 'parent', {
      name: 'parent',
      displayName: 'Parent',
      description: 'd',
      dependencies: ['dep-a'],
      files: [{ source: 'a.js', destination: 'a.js' }]
    });
    await readTemplateRegistry(true);

    const child = {
      name: 'child',
      displayName: 'Child',
      description: 'd',
      extends: 'parent',
      dependencies: ['dep-b'],
      files: [{ source: 'b.js', destination: 'b.js' }]
    };

    const resolved = await resolveTemplateInheritance(child);

    expect(resolved.dependencies.sort()).toEqual(['dep-a', 'dep-b']);
    expect(resolved.files.map(f => f.destination).sort()).toEqual(['a.js', 'b.js']);
    expect(resolved._resolvedFrom).toContain('parent');
  });

  it('should stop at circular inheritance rather than recursing forever', async () => {
    writeTemplate('function', 'a', {
      name: 'a', displayName: 'A', description: 'd', extends: 'b'
    });
    writeTemplate('function', 'b', {
      name: 'b', displayName: 'B', description: 'd', extends: 'a'
    });
    await readTemplateRegistry(true);

    const resolved = await resolveTemplateInheritance(await getTemplateByName('a'));

    expect(resolved.name).toBe('a');
  });

  it('should return the child when the parent is missing', async () => {
    const child = { name: 'orphan', displayName: 'O', description: 'd', extends: 'not-there' };

    const resolved = await resolveTemplateInheritance(child);

    expect(resolved).toBe(child);
  });
});

describe('registerCustomTemplate', () => {
  it('should register a valid custom template directory', async () => {
    const dir = path.join(root, 'external', 'my-template');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify({
      name: 'my-template',
      displayName: 'My Template',
      description: 'External template',
      type: 'function'
    }));

    const registered = await registerCustomTemplate(dir);

    expect(registered.name).toBe('my-template');
    expect(fs.existsSync(paths.custom)).toBe(true);
  });

  it('should throw for a directory that does not exist', async () => {
    await expect(registerCustomTemplate(path.join(root, 'nope'))).rejects.toThrow();
  });

  it('should throw for a directory without valid metadata', async () => {
    const dir = path.join(root, 'external', 'invalid');
    fs.mkdirSync(dir, { recursive: true });

    await expect(registerCustomTemplate(dir)).rejects.toThrow();
  });
});
