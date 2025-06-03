/**
 * Switch profile command implementation for Glia Functions CLI
 *
 * Switches to a different named profile
 */

import { switchProfile, listProfiles } from '../../lib/config.js';
import { showSuccess, showError, showWarning, showInfo } from '../../cli/error-handler.js';
import { ConfigurationError } from '../../lib/errors.js';

/**
 * Switches to a different profile
 * 
 * @param {Object} options - Command options
 * @param {string} options.name - Profile name to switch to
 * @returns {Promise<Object>} - Command result
 */
export default async function switchProfileCommand(options) {
  try {
    const profileName = options.name;
    
    if (!profileName) {
      throw new ConfigurationError('Profile name is required');
    }

    // Get all available profiles for validation
    const profiles = listProfiles();
    
    // Check if profile exists (also checked in switchProfile, but better UX to check here)
    if (!profiles.includes(profileName) && profileName !== 'default') {
      const availableProfiles = profiles.length > 0 
        ? `Available profiles: ${profiles.join(', ')}${profiles.includes('default') ? '' : ', default'}`
        : 'No profiles found besides the default profile.';
        
      showWarning(`Profile '${profileName}' does not exist. ${availableProfiles}`);
      throw new ConfigurationError(`Profile '${profileName}' does not exist`);
    }
    
    // Switch to the profile
    await switchProfile(profileName);
    
    showSuccess(`Switched to profile '${profileName}'`);
    showInfo('The new profile will be used for all subsequent operations.');
    
    return { 
      success: true, 
      profileName,
      message: `Switched to profile '${profileName}'`
    };
  } catch (error) {
    showError(`Failed to switch profile: ${error.message}`);
    throw error;
  }
}