/**
 * Debug utility for conditional logging
 *
 * Logs messages only when DEBUG_MODE environment variable is set to 'true'
 * This helps keep production output clean while allowing debugging when needed.
 */

/**
 * Check if debug mode is enabled
 * @returns {boolean} True if DEBUG_MODE is set to 'true'
 */
export function isDebugMode() {
  return process.env.DEBUG_MODE === 'true';
}

/**
 * Log a debug message if debug mode is enabled
 * @param {...any} args - Arguments to pass to console.log
 */
export function debug(...args) {
  if (isDebugMode()) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Log a debug info message if debug mode is enabled
 * @param {...any} args - Arguments to pass to console.info
 */
export function debugInfo(...args) {
  if (isDebugMode()) {
    console.info('[DEBUG]', ...args);
  }
}

/**
 * Log a debug warning message if debug mode is enabled
 * @param {...any} args - Arguments to pass to console.warn
 */
export function debugWarn(...args) {
  if (isDebugMode()) {
    console.warn('[DEBUG]', ...args);
  }
}

/**
 * Log a debug error message if debug mode is enabled
 * @param {...any} args - Arguments to pass to console.error
 */
export function debugError(...args) {
  if (isDebugMode()) {
    console.error('[DEBUG]', ...args);
  }
}

export default {
  isDebugMode,
  debug,
  debugInfo,
  debugWarn,
  debugError
};
