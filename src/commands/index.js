/**
 * Export all commands from a single entry point
 * 
 * This provides a clean API for accessing all command implementations
 */

// Function management commands
export { default as createAndDeployVersion } from './createAndDeployVersion.js';
export { default as createFunction } from './createFunction.js';
export { default as updateFunction } from './updateFunction.js';
export { default as fetchLogs } from './fetchLogs.js';
export { default as invokeFunction } from './invokeFunction.js';
export { default as listFunctions } from './listFunctions.js';
export { default as listTemplates } from './listTemplates.js';
export { default as init } from './init.js';
export { default as dev } from './dev.js';

// Profile management commands
export { default as createProfile } from './profiles/createProfile.js';
export { default as listProfiles } from './profiles/listProfiles.js';
export { default as switchProfile } from './profiles/switchProfile.js';
export { default as deleteProfile } from './profiles/deleteProfile.js';
