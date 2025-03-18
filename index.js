/**
 * Legacy CLI entry point for Glia Functions CLI
 * 
 * @deprecated Use bin/glia-functions.js instead
 */

import { runCLI } from './src/cli/index.js';

// Log deprecation warning on import
console.warn('WARNING: Using the legacy CLI entry point is deprecated.');
console.warn('Please use bin/glia-functions.js instead.');

// Forward to the new CLI implementation
runCLI();
