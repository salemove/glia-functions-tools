/**
 * Delete profile command implementation for Glia Functions CLI
 *
 * Deletes a named profile
 */

import { deleteProfile } from '../../lib/config.js';
import { showSuccess, showError, showWarning } from '../../cli/error-handler.js';
import { ConfigurationError } from '../../lib/errors.js';

/**
 * Deletes a named profile
 * 
 * @param {Object} options - Command options
 * @param {string} options.name - Profile name to delete
 * @returns {Promise<Object>} - Command result
 */
export default async function deleteProfileCommand(options) {
  try {
    const profileName = options.name;
    
    if (!profileName) {
      throw new ConfigurationError('Profile name is required');
    }
    
    // Confirm before deleting
    if (!options.force && options.confirm !== false) {
      throw new Error('Profile deletion requires confirmation. Use --force to skip confirmation.');
    }
    
    // Delete the profile
    await deleteProfile(profileName);
    
    showSuccess(`Profile '${profileName}' deleted successfully`);
    
    return { 
      success: true, 
      profileName,
      message: `Profile '${profileName}' deleted successfully`
    };
  } catch (error) {
    showError(`Failed to delete profile: ${error.message}`);
    throw error;
  }
}