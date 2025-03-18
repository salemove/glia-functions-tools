/**
 * [HISTORICAL] Script that created bridge modules for utils/ to src/utils/ migration
 * 
 * NOTE: As of March 2025, the utils/ directory has been completely removed.
 * This script is kept for historical reference only.
 * 
 * The migration process involved:
 * 1. Creating bridge modules in utils/ that re-exported from src/utils/
 * 2. Adding deprecation warnings to these bridge modules
 * 3. Verifying no code depended on the utils/ path
 * 4. Removing the utils/ directory entirely
 * 
 * All utility functions are now located in src/utils/ and should be imported directly
 * from there.
 */

console.log('This script is kept for historical reference only.');
console.log('The utils/ directory has been removed as of March 2025.');
console.log('All utility functions are now in src/utils/');
