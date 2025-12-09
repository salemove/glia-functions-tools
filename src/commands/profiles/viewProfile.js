/**
 * View profile command implementation for Glia Functions CLI
 *
 * Displays the configuration details of a specific profile
 */

import { getProfileConfig, listProfiles } from '../../lib/config.js';
import { showSuccess, showError, showWarning } from '../../cli/error-handler.js';
import { ConfigurationError } from '../../lib/errors.js';
import colorizer from '../../utils/colorizer.js';

/**
 * Masks sensitive values for display
 *
 * @param {string} key - Configuration key
 * @param {string} value - Configuration value
 * @returns {string} Masked or original value
 */
function maskSensitiveValue(key, value) {
  if (!value) return value;

  // Fully mask API key secret
  if (key === 'GLIA_KEY_SECRET') {
    if (value.length > 12) {
      return `${value.substring(0, 4)}${'*'.repeat(value.length - 8)}${value.substring(value.length - 4)}`;
    }
    return `${value.substring(0, 2)}${'*'.repeat(Math.max(value.length - 2, 4))}`;
  }

  // Show first 8 chars of Key ID, mask the rest
  if (key === 'GLIA_KEY_ID') {
    const showChars = Math.min(8, value.length);
    return `${value.substring(0, showChars)}${'*'.repeat(Math.max(value.length - showChars, 4))}`;
  }

  // Truncate bearer token - just show first 12 chars
  if (key === 'GLIA_BEARER_TOKEN') {
    const showChars = Math.min(12, value.length);
    return `${value.substring(0, showChars)}${'*'.repeat(Math.min(20, Math.max(value.length - showChars, 8)))}`;
  }

  // Decode and format expiration timestamp
  if (key === 'GLIA_TOKEN_EXPIRES_AT') {
    try {
      const timestamp = parseInt(value, 10);
      if (!isNaN(timestamp)) {
        const date = new Date(timestamp * 1000);
        const utcString = date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
        return `${value} (${utcString})`;
      }
    } catch (error) {
      // If parsing fails, just return the original value
    }
    return value;
  }

  return value;
}

/**
 * Views the configuration of a specific profile
 *
 * @param {Object} options - Command options
 * @param {string} options.name - Profile name to view
 * @param {boolean} options.showSecrets - Whether to show unmasked secrets (default: false)
 * @returns {Promise<Object>} - Command result
 */
export default async function viewProfileCommand(options) {
  try {
    const profileName = options.name;

    if (!profileName) {
      throw new ConfigurationError('Profile name is required');
    }

    // Check if profile exists
    const profiles = listProfiles();
    if (!profiles.includes(profileName) && profileName !== 'default') {
      throw new ConfigurationError(`Profile '${profileName}' does not exist`);
    }

    // Get profile configuration
    const config = getProfileConfig(profileName);

    // Display profile header
    console.log('');
    console.log(colorizer.blue(`Profile: ${colorizer.bold(profileName)}`));
    console.log('='.repeat(50));
    console.log('');

    // If profile is empty
    if (Object.keys(config).length === 0) {
      showWarning(`Profile '${profileName}' has no configuration set`);
      console.log('');
      console.log('You can add configuration using:');
      console.log(colorizer.dim(`  glia-functions profiles update --name ${profileName}`));
      console.log('');

      return {
        success: true,
        profileName,
        config: {},
        isEmpty: true
      };
    }

    // Display configuration
    const displayKeys = [
      'GLIA_SITE_ID',
      'GLIA_KEY_ID',
      'GLIA_KEY_SECRET',
      'GLIA_API_URL',
      'GLIA_BEARER_TOKEN',
      'GLIA_TOKEN_EXPIRES_AT'
    ];

    // Show known keys first
    displayKeys.forEach(key => {
      if (config[key]) {
        const value = options.showSecrets
          ? config[key]
          : maskSensitiveValue(key, config[key]);
        console.log(`${colorizer.cyan(key.padEnd(25))}: ${value}`);
      }
    });

    // Show any other keys that aren't in the standard list
    Object.keys(config)
      .filter(key => !displayKeys.includes(key))
      .forEach(key => {
        const value = options.showSecrets
          ? config[key]
          : maskSensitiveValue(key, config[key]);
        console.log(`${colorizer.cyan(key.padEnd(25))}: ${value}`);
      });

    console.log('');

    if (!options.showSecrets) {
      console.log(colorizer.dim('Note: Sensitive values are masked. Use --show-secrets to reveal them.'));
      console.log('');
    }

    showSuccess(`Profile '${profileName}' configuration displayed`);

    return {
      success: true,
      profileName,
      config,
      isEmpty: false
    };
  } catch (error) {
    showError(`Failed to view profile: ${error.message}`);
    throw error;
  }
}
