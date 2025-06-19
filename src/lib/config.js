/**
 * Configuration management for Glia Functions CLI
 * 
 * Handles loading environment variables and managing configuration settings
 * Supports both local (.env) and global (~/.glia-cli/config.env) credentials
 * Includes profile management for multiple environments
 * 
 * The configuration system uses a layered approach for maximum flexibility:
 * 1. CLI arguments (highest precedence)
 * 2. Local .env file 
 * 3. Active profile config
 * 4. Global config file
 * 5. Environment variables
 * 6. Default values (lowest precedence)
 * 
 * @module config
 */

import dotenv from 'dotenv';
import { ConfigurationError, AuthenticationError } from './errors.js';
import * as fs from 'fs';
import path from 'path';
import os from 'os';

// Default configuration values
const DEFAULT_CONFIG = {
  apiUrl: 'https://api.glia.com',
  defaultProfile: 'default'
};

// Global config paths
const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.glia-cli');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.env');
const PROFILES_DIR = path.join(GLOBAL_CONFIG_DIR, 'profiles');
const LOCAL_CONFIG_FILE = './.env';

// Ensure global config and profiles directories exist
try {
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }
} catch (error) {
  // Silent fail - we'll handle this during actual operations
  console.error(`Warning: Could not create global config directory: ${error.message}`);
}

/**
 * Gets the current active profile name from the global config
 * 
 * @returns {string} Current profile name or 'default'
 */
function getCurrentProfileName() {
  try {
    if (process.env.GLIA_PROFILE) {
      return process.env.GLIA_PROFILE;
    }
    
    // Try to get from global config
    if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
      const globalConfig = loadEnvFile(GLOBAL_CONFIG_FILE);
      if (globalConfig.GLIA_PROFILE) {
        return globalConfig.GLIA_PROFILE;
      }
    }
    
    // Default profile if none specified
    return DEFAULT_CONFIG.defaultProfile;
  } catch (error) {
    return DEFAULT_CONFIG.defaultProfile;
  }
}

/**
 * Gets the path to the active profile configuration file
 * 
 * @param {string} profileName - Profile name
 * @returns {string} Path to profile config file
 */
function getProfilePath(profileName) {
  return path.join(PROFILES_DIR, `${profileName}.env`);
}

/**
 * Load from a specific dotenv file if it exists
 *
 * @param {string} filePath - Path to .env file
 * @returns {Object} Environment variables loaded from the file or empty object
 */
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    
    // Load the env file and return parsed contents
    const result = dotenv.config({ path: filePath });
    
    if (result.error) {
      console.error(`Warning: Error loading ${filePath}: ${result.error.message}`);
      return {};
    }
    
    return result.parsed || {};
  } catch (error) {
    console.error(`Warning: Could not load ${filePath}: ${error.message}`);
    return {};
  }
}

/**
 * Lists all available profiles
 * 
 * @returns {Array<string>} List of profile names
 */
export function listProfiles() {
  try {
    if (!fs.existsSync(PROFILES_DIR)) {
      return [];
    }
    
    const files = fs.readdirSync(PROFILES_DIR);
    return files
      .filter(file => file.endsWith('.env'))
      .map(file => file.replace(/\.env$/, ''));
  } catch (error) {
    console.error(`Warning: Error listing profiles: ${error.message}`);
    return [];
  }
}

/**
 * Loads the configuration from environment variables and .env files
 * Uses layered configuration resolution:
 * 1. CLI args (already in process.env)
 * 2. Local .env file 
 * 3. Active profile config
 * 4. Global config file
 * 5. Default values
 * 
 * @returns {Object} The loaded configuration
 */
export async function loadConfig() {
  // Start with process.env defaults
  const originalEnvVars = { ...process.env };
  
  // Get active profile name
  const profileName = getCurrentProfileName();
  
  // Load profile config if it exists (medium precedence)
  const profilePath = getProfilePath(profileName);
  const profileEnv = loadEnvFile(profilePath);
  
  // Load global config (lower precedence)
  const globalEnv = loadEnvFile(GLOBAL_CONFIG_FILE);
  
  // Load local config (highest precedence)
  const localEnv = loadEnvFile(LOCAL_CONFIG_FILE);
  
  // Merge environment variables in order of precedence:
  // 1. Default values (lowest precedence)
  // 2. Global config file
  // 3. Active profile config
  // 4. Local .env file
  // 5. Process environment variables (highest precedence - CLI arguments)
  // Fix: Changed order to correctly apply precedence (process.env needs to be LAST parameter)
  const combinedEnv = { ...globalEnv, ...profileEnv, ...localEnv, ...process.env };
  
  // Assign back to process.env
  // Skip assigning empty values to prevent overriding valid credentials
  Object.keys(combinedEnv).forEach(key => {
    if (combinedEnv[key] !== '' && combinedEnv[key] !== null && combinedEnv[key] !== undefined) {
      process.env[key] = combinedEnv[key];
    }
  });
  
  // Create final config object
  const config = {
    keyId: process.env.GLIA_KEY_ID,
    keySecret: process.env.GLIA_KEY_SECRET,
    siteId: process.env.GLIA_SITE_ID,
    apiUrl: process.env.GLIA_API_URL || DEFAULT_CONFIG.apiUrl,
    bearerToken: process.env.GLIA_BEARER_TOKEN,
    tokenExpiresAt: process.env.GLIA_TOKEN_EXPIRES_AT ? 
      parseInt(process.env.GLIA_TOKEN_EXPIRES_AT, 10) : null,
    profile: profileName
  };
  
  return config;
}

/**
 * Validates the loaded configuration
 * 
 * @param {Object} config - The configuration to validate
 * @param {Array<string>} requiredFields - List of fields that must be present
 * @returns {Object} The validated configuration
 * @throws {ConfigurationError} If required configuration is missing
 */
export function validateConfig(config, requiredFields = []) {
  const missingFields = [];
  
  for (const field of requiredFields) {
    if (!config[field]) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    throw new ConfigurationError(
      `Missing required configuration: ${missingFields.join(', ')}`,
      { missingFields }
    );
  }
  
  return config;
}

/**
 * Gets configuration for authentication
 * 
 * @returns {Object} Authentication configuration
 * @throws {ConfigurationError} If required auth configuration is missing
 */
export async function getAuthConfig() {
  const config = await loadConfig();
  return validateConfig(config, ['keyId', 'keySecret']);
}

/**
 * Gets configuration for API operations
 * 
 * @returns {Object} API configuration
 * @throws {ConfigurationError} If required API configuration is missing
 */
export async function getApiConfig() {
  const config = await loadConfig();
  return validateConfig(config, ['bearerToken', 'siteId', 'apiUrl']);
}

/**
 * Checks if the current bearer token is valid and not expired
 * 
 * @param {boolean} [attemptRefresh=false] - Whether to attempt to refresh an expired token
 * @returns {Promise<boolean>} True if token exists, has not expired, and has a site ID
 */
export async function hasValidBearerToken(attemptRefresh = false) {
  try {
    const config = await loadConfig();
    
    if (!config.bearerToken || !config.siteId) {
      return false;
    }
    
    // Check if token has an expiration time
    if (config.tokenExpiresAt) {
      // Check if token has expired (adding a 5-min buffer)
      const now = Date.now();
      const expiryTimeWithBuffer = config.tokenExpiresAt - (5 * 60 * 1000);
      
      if (now >= expiryTimeWithBuffer) {
        console.log(`Token expired or about to expire. Current time: ${new Date(now).toISOString()}, expiry: ${new Date(config.tokenExpiresAt).toISOString()}`);
        
        // If requested, try to refresh the token automatically
        if (attemptRefresh && config.keyId && config.keySecret) {
          const refreshed = await refreshBearerTokenIfNeeded();
          return refreshed;
        }
        
        return false; // Token has expired or is about to expire
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validates a token against the API
 * 
 * @param {string} token - The token to validate
 * @param {string} apiUrl - API URL
 * @returns {Promise<boolean>} True if token is valid
 */
export async function validateToken(token, apiUrl) {
  if (!token || !apiUrl) return false;
  
  try {
    // Simple request to test the token - just fetch user info
    const response = await fetch(`${apiUrl}/operator_authentication/sessions/current`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.salemove.v1+json'
      }
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Automatically refreshes the bearer token if needed
 * 
 * @returns {Promise<boolean>} True if token was refreshed, false if no refresh was needed or possible
 */
export async function refreshBearerTokenIfNeeded() {
  try {
    const config = await loadConfig();
    
    // Skip if we don't have credentials to refresh the token
    if (!config.keyId || !config.keySecret) {
      console.log('Cannot refresh token: API credentials not found');
      return false;
    }
    
    // Check if we need to refresh the token
    const needsRefresh = !config.bearerToken || 
                        !config.tokenExpiresAt ||
                        Date.now() >= (config.tokenExpiresAt - (5 * 60 * 1000)); // 5 min buffer
    
    if (!needsRefresh) {
      return false; // Token is still valid
    }
    
    console.log('Token expired or about to expire, refreshing...');
    
    // Fetch a new bearer token
    const response = await fetch(`${config.apiUrl || 'https://api.glia.com'}/operator_authentication/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.salemove.v1+json'
      },
      body: JSON.stringify({
        api_key_id: config.keyId,
        api_key_secret: config.keySecret
      })
    });
    
    if (!response.ok) {
      throw new AuthenticationError(`Failed to refresh token: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Calculate expiration time
    const expiresInMs = data.expires_in ? data.expires_in * 1000 : 55 * 60 * 1000;
    const expiresAt = Date.now() + expiresInMs;
    
    // Update the token in config
    const tokenUpdates = {
      'GLIA_BEARER_TOKEN': data.token,
      'GLIA_TOKEN_EXPIRES_AT': expiresAt
    };
    
    // Update process.env immediately
    process.env.GLIA_BEARER_TOKEN = data.token;
    process.env.GLIA_TOKEN_EXPIRES_AT = expiresAt.toString();
    
    // Update the storage based on active profile
    const profileName = getCurrentProfileName();
    
    if (profileName !== 'default') {
      // Update the profile
      await updateProfile(profileName, tokenUpdates);
    } else {
      // Update global config
      await updateGlobalConfig(tokenUpdates);
    }
    
    // Also update local .env if it exists
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      await updateEnvFile(tokenUpdates);
    }
    
    console.log('Bearer token refreshed successfully');
    return true;
  } catch (error) {
    console.error(`Error refreshing bearer token: ${error.message}`);
    return false;
  }
}

/**
 * Updates an .env file with new values
 * 
 * @param {string} envPath - Path to the .env file
 * @param {Object} updates - Key-value pairs to update in .env
 * @returns {Promise<void>}
 */
async function updateEnvFileAtPath(envPath, updates) {
  let envContent = '';
  try {
    envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  } catch (error) {
    throw new ConfigurationError(
      `Failed to read env file ${envPath}: ${error.message}`,
      { error, path: envPath }
    );
  }
  
  // Update existing values or add new ones
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`${key}\\s*=.*`, 'g');
    
    if (regex.test(envContent)) {
      // Update existing value
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      // Add new value
      envContent += `\n${key}=${value}`;
    }
  }
  
  try {
    fs.writeFileSync(envPath, envContent, { mode: 0o600 }); // Set secure permissions
    
    if (envPath === GLOBAL_CONFIG_FILE) {
      // Ensure the global config file has secure permissions
      fs.chmodSync(envPath, 0o600);
    }
  } catch (error) {
    throw new ConfigurationError(
      `Failed to write env file ${envPath}: ${error.message}`,
      { error, path: envPath }
    );
  }
}

/**
 * Updates the local .env file with new values
 * 
 * @param {Object} updates - Key-value pairs to update in .env
 * @returns {Promise<void>}
 */
export async function updateEnvFile(updates) {
  return updateEnvFileAtPath(LOCAL_CONFIG_FILE, updates);
}

/**
 * Updates the global config file with new values
 * 
 * @param {Object} updates - Key-value pairs to update in global config
 * @returns {Promise<void>}
 */
export async function updateGlobalConfig(updates) {
  return updateEnvFileAtPath(GLOBAL_CONFIG_FILE, updates);
}

/**
 * Creates a new named profile
 * 
 * @param {string} profileName - Name of the profile to create
 * @param {Object} config - Configuration values for the profile
 * @returns {Promise<void>}
 */
export async function createProfile(profileName) {
  if (!profileName || typeof profileName !== 'string') {
    throw new ConfigurationError('Profile name is required');
  }
  
  // Sanitize profile name (alphanumeric, dash, underscore only)
  const sanitized = profileName.replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitized !== profileName) {
    throw new ConfigurationError('Profile name can only contain letters, numbers, dashes, and underscores');
  }
  
  const profilePath = getProfilePath(profileName);
  
  // Check if profile already exists
  if (fs.existsSync(profilePath)) {
    throw new ConfigurationError(`Profile ${profileName} already exists`);
  }
  
  // Create empty profile file
  try {
    fs.writeFileSync(profilePath, '', { mode: 0o600 });
    return profileName;
  } catch (error) {
    throw new ConfigurationError(
      `Failed to create profile ${profileName}: ${error.message}`,
      { error }
    );
  }
}

/**
 * Updates a named profile with new configuration values
 * 
 * @param {string} profileName - Name of the profile to update
 * @param {Object} updates - Key-value pairs to update in the profile
 * @returns {Promise<void>}
 */
export async function updateProfile(profileName, updates) {
  if (!profileName || typeof profileName !== 'string') {
    throw new ConfigurationError('Profile name is required');
  }
  
  const profilePath = getProfilePath(profileName);
  
  // Create profile if it doesn't exist
  if (!fs.existsSync(profilePath)) {
    await createProfile(profileName);
  }
  
  return updateEnvFileAtPath(profilePath, updates);
}

/**
 * Switches to a different named profile
 * 
 * @param {string} profileName - Name of the profile to switch to
 * @returns {Promise<void>}
 * @throws {ConfigurationError} If the profile doesn't exist
 */
export async function switchProfile(profileName) {
  if (!profileName || typeof profileName !== 'string') {
    throw new ConfigurationError('Profile name is required');
  }
  
  const profilePath = getProfilePath(profileName);
  
  // Check if profile exists
  if (!fs.existsSync(profilePath)) {
    // Special handling for default profile - create it if missing
    if (profileName === 'default') {
      console.log(`Creating missing default profile at ${profilePath}`);
      await createProfile('default');
    } else {
      throw new ConfigurationError(`Profile ${profileName} does not exist`);
    }
  }
  
  // Update global config to use this profile
  await updateGlobalConfig({
    'GLIA_PROFILE': profileName
  });
  
  // Update process.env for immediate effect
  process.env.GLIA_PROFILE = profileName;
  
  // Clear token-related environment variables to ensure they're reloaded from the new profile
  delete process.env.GLIA_BEARER_TOKEN;
  delete process.env.GLIA_TOKEN_EXPIRES_AT;
  
  // Reload config from the new profile
  await loadConfig();
  
  // Force token refresh on next API call
  await refreshBearerTokenIfNeeded();
  
  return profileName;
}

/**
 * Deletes a named profile
 * 
 * @param {string} profileName - Name of the profile to delete
 * @returns {Promise<void>}
 * @throws {ConfigurationError} If trying to delete the active profile
 */
export async function deleteProfile(profileName) {
  if (!profileName || typeof profileName !== 'string') {
    throw new ConfigurationError('Profile name is required');
  }
  
  // Don't allow deleting the default profile
  if (profileName === DEFAULT_CONFIG.defaultProfile) {
    throw new ConfigurationError(`Cannot delete the ${DEFAULT_CONFIG.defaultProfile} profile`);
  }
  
  // Don't allow deleting the active profile
  const currentProfile = getCurrentProfileName();
  if (profileName === currentProfile) {
    throw new ConfigurationError('Cannot delete the active profile. Switch to another profile first.');
  }
  
  const profilePath = getProfilePath(profileName);
  
  // Check if profile exists
  if (!fs.existsSync(profilePath)) {
    throw new ConfigurationError(`Profile ${profileName} does not exist`);
  }
  
  // Delete the profile file
  try {
    fs.unlinkSync(profilePath);
  } catch (error) {
    throw new ConfigurationError(
      `Failed to delete profile ${profileName}: ${error.message}`,
      { error }
    );
  }
}

/**
 * Gets the CLI version from package.json
 * 
 * @returns {string} The CLI version
 */
export function getCliVersion() {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve('./package.json'), 'utf8')
    );
    return packageJson.version || '0.1.0';
  } catch (error) {
    // Default to development version if we can't read package.json
    return '0.1.0-dev';
  }
}
