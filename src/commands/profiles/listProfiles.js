/**
 * List profiles command implementation for Glia Functions CLI
 *
 * Lists all available profiles and shows the currently active one
 */

import { listProfiles } from '../../lib/config.js';
import { showSuccess, showError, showWarning } from '../../cli/error-handler.js';
import chalk from 'chalk';

/**
 * Lists all available profiles
 * 
 * @param {Object} options - Command options
 * @param {boolean} options.detailed - Whether to show detailed output
 * @returns {Promise<Object>} - Command result
 */
export default async function listProfilesCommand(options) {
  try {
    // Get current profile name
    const currentProfile = process.env.GLIA_PROFILE || 'default';
    
    // Get all available profiles
    const profiles = listProfiles();
    
    if (profiles.length === 0) {
      showWarning('No profiles found. The default profile will be used.');
      return {
        success: true,
        profiles: [],
        currentProfile
      };
    }
    
    // Ensure default profile is always in the list
    if (!profiles.includes('default')) {
      profiles.unshift('default');
    }
    
    showSuccess(`Found ${profiles.length} profiles:`);
    
    // Display results
    profiles.forEach(profile => {
      const isCurrent = profile === currentProfile;
      if (isCurrent) {
        console.log(`${chalk.green('*')} ${profile} ${chalk.green('(current)')}`);
      } else {
        console.log(`  ${profile}`);
      }
    });
    
    return {
      success: true,
      profiles,
      currentProfile
    };
  } catch (error) {
    showError(`Failed to list profiles: ${error.message}`);
    throw error;
  }
}