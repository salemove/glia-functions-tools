/**
 * Logging utilities for Glia export handlers
 * 
 * This module provides a standardized logging interface for export handlers.
 */

// Log levels with numeric values for comparison
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Default log level if not specified in environment
const DEFAULT_LOG_LEVEL = 'info';

/**
 * Determine if a log message should be output based on level
 * 
 * @param {string} messageLevel - Level of the message being logged
 * @param {string} configLevel - Configured minimum log level
 * @returns {boolean} True if message should be logged
 */
function shouldLog(messageLevel, configLevel) {
  const messageLevelValue = LOG_LEVELS[messageLevel] || LOG_LEVELS.info;
  const configLevelValue = LOG_LEVELS[configLevel] || LOG_LEVELS.info;
  
  return messageLevelValue >= configLevelValue;
}

/**
 * Format a log message with timestamp and level
 * 
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 * @returns {Object} Formatted log entry
 */
function formatLogEntry(level, message, data = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  };
}

/**
 * Get the configured log level from the environment
 * 
 * @param {Object} env - Environment variables
 * @returns {string} Log level
 */
function getLogLevel(env = process.env) {
  const level = (env.LOG_LEVEL || DEFAULT_LOG_LEVEL).toLowerCase();
  return LOG_LEVELS.hasOwnProperty(level) ? level : DEFAULT_LOG_LEVEL;
}

/**
 * Check if debug mode is enabled
 * 
 * @param {Object} env - Environment variables
 * @returns {boolean} True if debug mode is enabled
 */
function isDebugEnabled(env = process.env) {
  return env.DEBUG === 'true' || getLogLevel(env) === 'debug';
}

/**
 * Create a logger instance
 * 
 * @param {Object} options - Logger configuration
 * @returns {Object} Logger instance
 */
function createLogger(options = {}) {
  const env = options.env || process.env;
  const logLevel = getLogLevel(env);
  
  // Create log methods for each level
  const logger = {};
  
  Object.keys(LOG_LEVELS).forEach(level => {
    logger[level] = (message, data = {}) => {
      if (shouldLog(level, logLevel)) {
        const entry = formatLogEntry(level, message, data);
        
        // Use console methods corresponding to log levels
        switch (level) {
          case 'debug':
            console.debug(JSON.stringify(entry));
            break;
          case 'info':
            console.info(JSON.stringify(entry));
            break;
          case 'warn':
            console.warn(JSON.stringify(entry));
            break;
          case 'error':
            console.error(JSON.stringify(entry));
            break;
          default:
            console.log(JSON.stringify(entry));
        }
      }
    };
  });
  
  return logger;
}

// Create and export the default logger
export const logger = createLogger();

export default {
  logger,
  createLogger,
  getLogLevel,
  isDebugEnabled
};