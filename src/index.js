/**
 * Main entry point for the glia-functions-tools package
 * 
 * This file exports the public API of the package
 */

// Re-export core modules
export * from './lib/api.js';
export * from './lib/config.js';
export * from './lib/errors.js';
export * from './lib/validation.js';

// Re-export CLI
export { runCLI } from './cli/index.js';

// Export commands
export * from './commands/index.js';

// Export utilities
export * as utils from './utils/index.js';

// Export version
export const version = process.env.npm_package_version || '0.2.0';
