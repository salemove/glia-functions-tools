/**
 * Configuration management for Glia Functions CLI
 * 
 * Handles loading environment variables and managing configuration settings
 * Supports both local (.env) and global (~/.glia-cli/config.env) credentials
 */

import dotenv from 'dotenv';
import { ConfigurationError } from './errors.js';
import * as fs from 'fs';
import path from 'path';
import os from 'os';

// Default configuration values
const DEFAULT_CONFIG = {
  apiUrl: 'https://api.glia.com',
};

// Global config paths
const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.glia-cli');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.env');
const LOCAL_CONFIG_FILE = './.env';

// Ensure global config directory exists
try {
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
} catch (error) {
  // Silent fail - we'll handle this during actual operations
  console.error(`Warning: Could not create global config directory: ${error.message}`);
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
 * Loads the configuration from environment variables and .env files
 * Checks both local and global config files, with local taking precedence
 * 
 * @returns {Object} The loaded configuration
 */
export async function loadConfig() {
  // Start with process.env defaults
  const originalEnvVars = { ...process.env };
  
  // Load global config first (lower precedence)
  const globalEnv = loadEnvFile(GLOBAL_CONFIG_FILE);
  
  // Then load local config (higher precedence)
  const localEnv = loadEnvFile(LOCAL_CONFIG_FILE);
  
  // Merge environment variables in order of precedence:
  // 1. Local .env file (highest precedence)
  // 2. Global config file
  // 3. Process environment variables (already loaded)
  Object.assign(process.env, globalEnv, localEnv);
  
  // Create final config object
  const config = {
    keyId: process.env.GLIA_KEY_ID,
    keySecret: process.env.GLIA_KEY_SECRET,
    siteId: process.env.GLIA_SITE_ID,
    apiUrl: process.env.GLIA_API_URL || DEFAULT_CONFIG.apiUrl,
    bearerToken: process.env.GLIA_BEARER_TOKEN,
    tokenExpiresAt: process.env.GLIA_TOKEN_EXPIRES_AT ? 
      parseInt(process.env.GLIA_TOKEN_EXPIRES_AT, 10) : null
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
 * @returns {Promise<boolean>} True if token exists, has not expired, and has a site ID
 */
export async function hasValidBearerToken() {
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
