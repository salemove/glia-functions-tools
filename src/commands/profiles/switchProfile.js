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
    
    // Clear any API caches to ensure we're using the new profile's credentials
    try {
      // Import and clear the cache to ensure we use fresh credentials with the new profile
      const { ResponseCache } = await import('../../lib/cache.js');
      const apiModule = await import('../../lib/api.js');
      
      // If there's a shared API client instance, clear its cache
      if (global.apiClient && global.apiClient.cache) {
        global.apiClient.cache.clear();
        showInfo('API cache cleared for new profile.');
      } else {
        // Create a temporary cache just to clear any persistent storage
        const tempCache = new ResponseCache({ persistent: true });
        tempCache.clear();
        showInfo('Persistent cache cleared for new profile.');
      }
    } catch (cacheError) {
      // Non-fatal error, just log it
      showWarning(`Note: Could not clear API cache: ${cacheError.message}`);
    }
    
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