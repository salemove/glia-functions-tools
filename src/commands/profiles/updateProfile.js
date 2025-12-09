/**
 * Update profile command implementation for Glia Functions CLI
 *
 * Updates configuration values for a specific profile
 */

import { updateProfile, getProfileConfig, listProfiles } from '../../lib/config.js';
import { showSuccess, showError, showWarning } from '../../cli/error-handler.js';
import { ConfigurationError } from '../../lib/errors.js';
import colorizer from '../../utils/colorizer.js';

/**
 * Updates configuration for a specific profile
 *
 * @param {Object} options - Command options
 * @param {string} options.name - Profile name to update
 * @param {string} options.siteId - Site ID to set
 * @param {string} options.keyId - API Key ID to set
 * @param {string} options.keySecret - API Key Secret to set
 * @param {string} options.apiUrl - API URL to set
 * @param {Object} options.customVars - Custom environment variables to set
 * @returns {Promise<Object>} - Command result
 */
export default async function updateProfileCommand(options) {
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

    // Build updates object from options
    const updates = {};

    if (options.siteId !== undefined) {
      updates.GLIA_SITE_ID = options.siteId;
    }

    if (options.keyId !== undefined) {
      updates.GLIA_KEY_ID = options.keyId;
    }

    if (options.keySecret !== undefined) {
      updates.GLIA_KEY_SECRET = options.keySecret;
    }

    if (options.apiUrl !== undefined) {
      updates.GLIA_API_URL = options.apiUrl;
    }

    // Add any custom variables
    if (options.customVars && typeof options.customVars === 'object') {
      Object.assign(updates, options.customVars);
    }

    // Check if there are any updates to apply
    if (Object.keys(updates).length === 0) {
      showWarning('No configuration updates provided');
      console.log('');
      console.log('Available options:');
      console.log('  --site-id      Set the Glia Site ID');
      console.log('  --key-id       Set the API Key ID');
      console.log('  --key-secret   Set the API Key Secret');
      console.log('  --api-url      Set the API URL');
      console.log('');

      return {
        success: false,
        profileName,
        message: 'No updates provided'
      };
    }

    // Get current config for comparison
    let currentConfig = {};
    try {
      currentConfig = getProfileConfig(profileName);
    } catch (error) {
      // Profile might be empty, that's okay
    }

    // Update the profile
    await updateProfile(profileName, updates);

    // Display what was updated
    console.log('');
    console.log(colorizer.blue(`Updated profile: ${colorizer.bold(profileName)}`));
    console.log('='.repeat(50));
    console.log('');

    Object.keys(updates).forEach(key => {
      const oldValue = currentConfig[key] || colorizer.dim('(not set)');
      const newValue = updates[key];

      // Mask sensitive values in output
      const sensitiveKeys = ['GLIA_KEY_SECRET', 'GLIA_BEARER_TOKEN'];
      const displayOld = sensitiveKeys.includes(key) && oldValue !== colorizer.dim('(not set)')
        ? '***'
        : oldValue;
      const displayNew = sensitiveKeys.includes(key) ? '***' : newValue;

      console.log(`${colorizer.cyan(key)}:`);
      console.log(`  ${colorizer.dim('Old:')} ${displayOld}`);
      console.log(`  ${colorizer.green('New:')} ${displayNew}`);
      console.log('');
    });

    showSuccess(`Profile '${profileName}' updated successfully`);

    return {
      success: true,
      profileName,
      updates,
      message: `Profile '${profileName}' updated successfully`
    };
  } catch (error) {
    showError(`Failed to update profile: ${error.message}`);
    throw error;
  }
}
