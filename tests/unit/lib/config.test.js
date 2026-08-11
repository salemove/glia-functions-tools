/**
 * Tests for the configuration module.
 *
 * These run against a real temporary config directory rather than a mocked
 * `node:fs` / `node:os` / `node:path`. The previous version mocked all three
 * builtins, which does not work under ESM (jest.mock does not hoist or replace
 * modules here), and additionally asserted on `jest.spyOn(global, ...)` handles
 * for functions that were never globals — so those assertions could not fail.
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// config.js resolves its directory at import time, so point it at a scratch
// directory before importing it.
const CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'glia-config-test-'));
process.env.GLIA_CONFIG_DIR = CONFIG_DIR;

const {
  loadConfig,
  validateConfig,
  switchProfile,
  createProfile,
  refreshBearerTokenIfNeeded,
  listProfiles,
  getCurrentProfileName,
  getConfigDir,
  updateGlobalConfig
} = await import('../../../src/lib/config.js');

const PROFILES_DIR = path.join(CONFIG_DIR, 'profiles');
const GLOBAL_CONFIG_FILE = path.join(CONFIG_DIR, 'config.env');

/** Environment keys the config module reads or writes. */
const MANAGED_ENV_KEYS = [
  'GLIA_PROFILE', 'GLIA_KEY_ID', 'GLIA_KEY_SECRET', 'GLIA_SITE_ID',
  'GLIA_API_URL', 'GLIA_BEARER_TOKEN', 'GLIA_TOKEN_EXPIRES_AT'
];

describe('Config module', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = {};
    for (const key of MANAGED_ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }

    // Start each test from an empty config directory.
    fs.rmSync(PROFILES_DIR, { recursive: true, force: true });
    fs.rmSync(GLOBAL_CONFIG_FILE, { force: true });
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  });

  afterEach(() => {
    for (const key of MANAGED_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  afterAll(() => {
    fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
  });

  describe('getConfigDir', () => {
    it('should honour GLIA_CONFIG_DIR', () => {
      expect(getConfigDir()).toBe(CONFIG_DIR);
    });
  });

  describe('loadConfig', () => {
    it('should give process.env precedence over profile and global files', async () => {
      fs.writeFileSync(GLOBAL_CONFIG_FILE, 'GLIA_API_URL=https://global.example.com\n');
      fs.writeFileSync(
        path.join(PROFILES_DIR, 'test-profile.env'),
        'GLIA_SITE_ID=profile-site\nGLIA_API_URL=https://profile.example.com\n'
      );

      process.env.GLIA_PROFILE = 'test-profile';
      process.env.GLIA_API_URL = 'https://env.example.com';

      const config = await loadConfig();

      expect(config.profile).toBe('test-profile');
      // Set only in the profile file, so it is picked up.
      expect(config.siteId).toBe('profile-site');
      // Set in all three layers; the environment wins.
      expect(config.apiUrl).toBe('https://env.example.com');
    });

    it('should fall back to the default profile name', async () => {
      const config = await loadConfig();
      expect(config.profile).toBe('default');
      expect(getCurrentProfileName()).toBe('default');
    });
  });

  describe('validateConfig', () => {
    it('should throw if required fields are missing', () => {
      expect(() => validateConfig({ field1: 'value1' }, ['field1', 'field2', 'field3']))
        .toThrow('Missing required configuration');
    });

    it('should return the config if all required fields are present', () => {
      const config = { field1: 'value1', field2: 'value2', field3: 'value3' };
      expect(validateConfig(config, ['field1', 'field2'])).toEqual(config);
    });
  });

  describe('listProfiles', () => {
    it('should list .env files as profile names and ignore anything else', () => {
      fs.writeFileSync(path.join(PROFILES_DIR, 'profile1.env'), '');
      fs.writeFileSync(path.join(PROFILES_DIR, 'profile2.env'), '');
      fs.writeFileSync(path.join(PROFILES_DIR, 'not-a-profile.txt'), '');

      expect(listProfiles().sort()).toEqual(['profile1', 'profile2']);
    });

    it('should return an empty array when the profiles directory is missing', () => {
      fs.rmSync(PROFILES_DIR, { recursive: true, force: true });
      expect(listProfiles()).toEqual([]);
    });
  });

  describe('switchProfile', () => {
    it('should persist the profile, update the environment and clear the token', async () => {
      await createProfile('new-profile', { GLIA_SITE_ID: 'new-site' });

      process.env.GLIA_BEARER_TOKEN = 'old-token';
      process.env.GLIA_TOKEN_EXPIRES_AT = '12345';

      await switchProfile('new-profile');

      expect(process.env.GLIA_PROFILE).toBe('new-profile');
      expect(fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf8')).toContain('GLIA_PROFILE=new-profile');

      // The old token belonged to the previous profile and must not leak across.
      expect(process.env.GLIA_BEARER_TOKEN).not.toBe('old-token');
      expect(process.env.GLIA_TOKEN_EXPIRES_AT).not.toBe('12345');
    });

    it('should throw if the profile does not exist', async () => {
      await expect(switchProfile('non-existent'))
        .rejects.toThrow('Profile non-existent does not exist');
    });
  });

  describe('refreshBearerTokenIfNeeded', () => {
    it('should request a new token when the current one has expired', async () => {
      process.env.GLIA_KEY_ID = 'test-key-id';
      process.env.GLIA_KEY_SECRET = 'test-key-secret';
      process.env.GLIA_API_URL = 'https://test-api.glia.com';
      process.env.GLIA_BEARER_TOKEN = 'expired-token';
      process.env.GLIA_TOKEN_EXPIRES_AT = (Date.now() - 10_000).toString();

      fetchMock.mockResponseOnce(JSON.stringify({ token: 'new-token', expires_in: 3600 }));

      const result = await refreshBearerTokenIfNeeded();

      expect(fetchMock).toHaveBeenCalledWith(
        'https://test-api.glia.com/operator_authentication/tokens',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            api_key_id: 'test-key-id',
            api_key_secret: 'test-key-secret'
          })
        })
      );
      expect(result).toBe(true);
      expect(process.env.GLIA_BEARER_TOKEN).toBe('new-token');
      expect(process.env.GLIA_TOKEN_EXPIRES_AT).toBeTruthy();
    });

    it('should not request a token when the current one is still valid', async () => {
      process.env.GLIA_KEY_ID = 'test-key-id';
      process.env.GLIA_KEY_SECRET = 'test-key-secret';
      process.env.GLIA_BEARER_TOKEN = 'valid-token';
      process.env.GLIA_TOKEN_EXPIRES_AT = (Date.now() + 3_600_000).toString();

      const result = await refreshBearerTokenIfNeeded();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(process.env.GLIA_BEARER_TOKEN).toBe('valid-token');
    });

    it('should report failure when there are no credentials to refresh with', async () => {
      delete process.env.GLIA_BEARER_TOKEN;

      const result = await refreshBearerTokenIfNeeded();

      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
