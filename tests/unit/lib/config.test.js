import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

// Mock modules
jest.mock('fs');
jest.mock('path');
jest.mock('os');
jest.mock('dotenv');

// Import the code to test
import { 
  loadConfig, 
  validateConfig,
  switchProfile,
  refreshBearerTokenIfNeeded,
  listProfiles,
  getCurrentProfileName
} from '../../../src/lib/config.js';

describe('Config module', () => {
  // Prepare mocks
  const mockHomedir = '/mock/home';
  const mockGlobalConfigDir = '/mock/home/.glia-cli';
  const mockProfilesDir = '/mock/home/.glia-cli/profiles';
  const mockGlobalConfigFile = '/mock/home/.glia-cli/config.env';
  const mockLocalConfigFile = './.env';
  
  // Setup process.env
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock homedir and path.join
    os.homedir.mockReturnValue(mockHomedir);
    path.join.mockImplementation((...paths) => paths.join('/'));
    
    // Mock filesystem
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockReturnValue(undefined);
    fs.readFileSync.mockReturnValue('');
    fs.writeFileSync.mockReturnValue(undefined);
    fs.chmodSync.mockReturnValue(undefined);
    
    // Mock dotenv
    dotenv.config.mockReturnValue({ 
      parsed: {} 
    });
    
    // Reset process.env before each test
    process.env = { ...originalEnv };
    
    // Mock fetch for token refresh
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'new-test-token', expires_in: 3600 })
    });
  });
  
  afterEach(() => {
    // Restore process.env
    process.env = originalEnv;
  });
  
  describe('loadConfig', () => {
    it('should load config with correct precedence', async () => {
      // Setup mocks for this test
      dotenv.config.mockImplementation((options) => {
        if (options.path === mockGlobalConfigFile) {
          return { parsed: { GLOBAL_VAR: 'global' } };
        } else if (options.path.includes('profiles/test-profile.env')) {
          return { parsed: { PROFILE_VAR: 'profile', COMMON_VAR: 'profile-value' } };
        } else if (options.path === mockLocalConfigFile) {
          return { parsed: { LOCAL_VAR: 'local', COMMON_VAR: 'local-value' } };
        }
        return { parsed: {} };
      });
      
      // Set process.env variables
      process.env.GLIA_PROFILE = 'test-profile';
      process.env.ENV_VAR = 'env';
      process.env.COMMON_VAR = 'env-value';
      
      // Call the function
      const config = await loadConfig();
      
      // Check that variables were properly merged with correct precedence
      expect(process.env.GLOBAL_VAR).toBe('global');
      expect(process.env.PROFILE_VAR).toBe('profile');
      expect(process.env.LOCAL_VAR).toBe('local');
      expect(process.env.ENV_VAR).toBe('env');
      
      // Most importantly - process.env should have highest precedence
      expect(process.env.COMMON_VAR).toBe('env-value');
      
      // Config object should contain the final values
      expect(config.profile).toBe('test-profile');
    });
  });
  
  describe('validateConfig', () => {
    it('should throw error if required fields are missing', () => {
      const config = { field1: 'value1' };
      const requiredFields = ['field1', 'field2', 'field3'];
      
      expect(() => validateConfig(config, requiredFields)).toThrow('Missing required configuration');
    });
    
    it('should return config if all required fields are present', () => {
      const config = { field1: 'value1', field2: 'value2', field3: 'value3' };
      const requiredFields = ['field1', 'field2'];
      
      expect(validateConfig(config, requiredFields)).toEqual(config);
    });
  });
  
  describe('switchProfile', () => {
    it('should update global config and process.env when switching profiles', async () => {
      // Mock profile exists
      fs.existsSync.mockReturnValue(true);
      
      // Mock functions
      const mockUpdateGlobalConfig = jest.spyOn(global, 'updateGlobalConfig')
        .mockImplementation(() => Promise.resolve());
      
      const mockLoadConfig = jest.spyOn(global, 'loadConfig')
        .mockImplementation(() => Promise.resolve());
        
      const mockRefreshToken = jest.spyOn(global, 'refreshBearerTokenIfNeeded')
        .mockImplementation(() => Promise.resolve(true));
        
      // Set initial process.env values
      process.env.GLIA_BEARER_TOKEN = 'old-token';
      process.env.GLIA_TOKEN_EXPIRES_AT = '12345';
      process.env.GLIA_SITE_ID = 'old-site-id';
      
      // Call the function
      await switchProfile('new-profile');
      
      // Check that global config was updated
      expect(mockUpdateGlobalConfig).toHaveBeenCalledWith({
        'GLIA_PROFILE': 'new-profile'
      });
      
      // Check that process.env was updated
      expect(process.env.GLIA_PROFILE).toBe('new-profile');
      
      // Check that bearer token variables were cleared
      expect(process.env.GLIA_BEARER_TOKEN).toBeUndefined();
      expect(process.env.GLIA_TOKEN_EXPIRES_AT).toBeUndefined();
      
      // Check that config was reloaded
      expect(mockLoadConfig).toHaveBeenCalled();
      
      // Check that token refresh was attempted
      expect(mockRefreshToken).toHaveBeenCalled();
    });
    
    it('should create default profile if it does not exist', async () => {
      // Mock default profile doesn't exist, then gets created
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('default.env')) {
          return false; // The first time we check, it doesn't exist
        }
        return true;
      });
      
      // Mock functions
      jest.spyOn(global, 'createProfile').mockImplementation(() => Promise.resolve('default'));
      jest.spyOn(global, 'updateGlobalConfig').mockImplementation(() => Promise.resolve());
      jest.spyOn(global, 'loadConfig').mockImplementation(() => Promise.resolve());
      jest.spyOn(global, 'refreshBearerTokenIfNeeded').mockImplementation(() => Promise.resolve(true));
      
      // Call the function
      await switchProfile('default');
      
      // Check that create profile was called
      expect(global.createProfile).toHaveBeenCalledWith('default');
    });
    
    it('should throw error if profile does not exist', async () => {
      // Mock profile doesn't exist
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await expect(switchProfile('non-existent')).rejects.toThrow('Profile non-existent does not exist');
    });
  });
  
  describe('refreshBearerTokenIfNeeded', () => {
    it('should refresh token when it is expired or missing', async () => {
      // Setup mock environment
      process.env.GLIA_KEY_ID = 'test-key-id';
      process.env.GLIA_KEY_SECRET = 'test-key-secret';
      process.env.GLIA_API_URL = 'https://test-api.glia.com';
      process.env.GLIA_BEARER_TOKEN = 'expired-token';
      process.env.GLIA_TOKEN_EXPIRES_AT = (Date.now() - 10000).toString(); // Expired
      
      // Mock fetch response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: 'new-token', expires_in: 3600 })
      });
      
      // Call the function
      const result = await refreshBearerTokenIfNeeded();
      
      // Check that fetch was called with correct arguments
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test-api.glia.com/operator_authentication/tokens',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            api_key_id: 'test-key-id',
            api_key_secret: 'test-key-secret'
          })
        })
      );
      
      // Check result
      expect(result).toBe(true);
      
      // Check that token was updated
      expect(process.env.GLIA_BEARER_TOKEN).toBe('new-token');
      expect(process.env.GLIA_TOKEN_EXPIRES_AT).toBeTruthy();
    });
    
    it('should not refresh token when it is valid', async () => {
      // Setup mock environment
      process.env.GLIA_KEY_ID = 'test-key-id';
      process.env.GLIA_KEY_SECRET = 'test-key-secret';
      process.env.GLIA_BEARER_TOKEN = 'valid-token';
      // Set expiration 1 hour in the future
      process.env.GLIA_TOKEN_EXPIRES_AT = (Date.now() + 3600000).toString(); 
      
      // Call the function
      const result = await refreshBearerTokenIfNeeded();
      
      // Check that fetch was not called
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Check result
      expect(result).toBe(false);
      
      // Check that token was not updated
      expect(process.env.GLIA_BEARER_TOKEN).toBe('valid-token');
    });
  });
  
  describe('listProfiles', () => {
    it('should return a list of profiles', () => {
      // Mock reading profiles directory
      fs.readdirSync.mockReturnValue(['profile1.env', 'profile2.env', 'not-a-profile.txt']);
      
      // Call the function
      const profiles = listProfiles();
      
      // Check result
      expect(profiles).toEqual(['profile1', 'profile2']);
    });
    
    it('should return empty array if profiles directory does not exist', () => {
      // Mock profiles directory doesn't exist
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      const profiles = listProfiles();
      
      // Check result
      expect(profiles).toEqual([]);
    });
  });
});