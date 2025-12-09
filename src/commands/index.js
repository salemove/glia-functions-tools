/**
 * Export all commands from a single entry point
 * 
 * This provides a clean API for accessing all command implementations
 */

// Function management commands
export { default as createAndDeployVersion } from './createAndDeployVersion.js';
export { default as createFunction } from './createFunction.js';
export { default as updateFunction } from './updateFunction.js';
export { default as deleteFunction } from './deleteFunction.js';
export { default as updateEnvVars } from './updateEnvVars.js';
export { default as fetchLogs } from './fetchLogs.js';
export { default as invokeFunction } from './invokeFunction.js';
export { default as listFunctions } from './listFunctions.js';
export { default as listTemplates } from './listTemplates.js';
export { default as init } from './init.js';
export { default as dev } from './dev.js';

// Scheduled functions commands
export { default as createSchedule } from './schedules/createSchedule.js';
export { default as listSchedules } from './schedules/listSchedules.js';
export { default as updateSchedule } from './schedules/updateSchedule.js';
export { default as deleteSchedule } from './schedules/deleteSchedule.js';

// Template management commands
export { default as templates } from './templates.js';

// Profile management commands
export { default as createProfile } from './profiles/createProfile.js';
export { default as listProfiles } from './profiles/listProfiles.js';
export { default as switchProfile } from './profiles/switchProfile.js';
export { default as deleteProfile } from './profiles/deleteProfile.js';

// KV store commands
export { default as getKvValue } from './kv-store/get.js';
export { default as setKvValue } from './kv-store/set.js';
export { default as deleteKvValue } from './kv-store/delete.js';
export { default as listKvPairs } from './kv-store/list.js';
export { default as testAndSetKvValue } from './kv-store/test-and-set.js';

// Applet management commands
export { default as createApplet } from './applets/createApplet.js';
export { default as deployApplet } from './applets/deployApplet.js';
export { default as listApplets } from './applets/listApplets.js';
export { default as updateApplet } from './applets/updateApplet.js';
export { default as listAppletTemplates } from './applets/listAppletTemplates.js';
export { default as selectApplet } from './applets/selectApplet.js';

// Project management commands
export { deployProject } from './projects/index.js';

// Export event handler commands
export { default as setupExportHandler } from './exports/setupExportHandler.js';

// MCP server commands
export { default as startMcpServer } from './startMcpServer.js';
