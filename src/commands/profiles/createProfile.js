/**
 * Create profile command implementation for Glia Functions CLI
 *
 * Creates a new named profile for storing credentials and configuration
 */

import { createProfile } from '../../lib/config.js';
import { showSuccess, showError, showWarning } from '../../cli/error-handler.js';
import { ConfigurationError } from '../../lib/errors.js';

/**
 * Creates a new named profile
 * 
 * @param {Object} options - Command options
 * @param {string} options.name - Profile name
 * @returns {Promise<Object>} - Command result
 */
export default async function createProfileCommand(options) {
  try {
    const profileName = options.name;
    
    if (!profileName) {
      throw new ConfigurationError('Profile name is required');
    }

    // Create the profile
    await createProfile(profileName);
    
    showSuccess(`Profile '${profileName}' created successfully`);
    
    return { 
      success: true, 
      profileName,
      message: `Profile '${profileName}' created successfully`
    };
  } catch (error) {
    showError(`Failed to create profile: ${error.message}`);
    throw error;
  }
}