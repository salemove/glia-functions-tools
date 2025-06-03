/**
 * Profile management commands for Glia Functions CLI
 * 
 * Exports all profile-related commands for use in the CLI
 */

import createProfileCommand from './createProfile.js';
import listProfilesCommand from './listProfiles.js';
import switchProfileCommand from './switchProfile.js';
import deleteProfileCommand from './deleteProfile.js';

export {
  createProfileCommand,
  listProfilesCommand,
  switchProfileCommand,
  deleteProfileCommand
};