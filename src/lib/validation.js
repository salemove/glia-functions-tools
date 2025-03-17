/**
 * Input validation utilities for Glia Functions CLI
 * 
 * Provides standardized validation for function names, IDs, and other inputs
 */

import { ValidationError } from './errors.js';

/**
 * Validates a function name
 * 
 * @param {string} name - Function name to validate
 * @returns {string} - The validated name
 * @throws {ValidationError} - If name is invalid
 */
export function validateFunctionName(name) {
  if (!name) {
    throw new ValidationError('Function name is required');
  }
  
  if (typeof name !== 'string') {
    throw new ValidationError('Function name must be a string', { provided: typeof name });
  }
  
  if (name.trim().length === 0) {
    throw new ValidationError('Function name cannot be empty');
  }
  
  if (!/^[a-zA-Z0-9-_\s]+$/.test(name)) {
    throw new ValidationError(
      'Function name must contain only alphanumeric characters, hyphens, underscores, and spaces',
      { provided: name }
    );
  }
  
  return name;
}

/**
 * Validates a function ID
 * 
 * @param {string} id - Function ID to validate
 * @returns {string} - The validated ID
 * @throws {ValidationError} - If ID is invalid
 */
export function validateFunctionId(id) {
  if (!id) {
    throw new ValidationError('Function ID is required');
  }
  
  if (typeof id !== 'string') {
    throw new ValidationError('Function ID must be a string', { provided: typeof id });
  }
  
  if (id.trim().length === 0) {
    throw new ValidationError('Function ID cannot be empty');
  }
  
  return id;
}

/**
 * Validates a file path
 * 
 * @param {string} path - File path to validate
 * @returns {string} - The validated path
 * @throws {ValidationError} - If path is invalid
 */
export function validateFilePath(path) {
  if (!path) {
    throw new ValidationError('File path is required');
  }
  
  if (typeof path !== 'string') {
    throw new ValidationError('File path must be a string', { provided: typeof path });
  }
  
  if (path.trim().length === 0) {
    throw new ValidationError('File path cannot be empty');
  }
  
  return path;
}

/**
 * Validates environment variables object
 * 
 * @param {object} env - Environment variables object to validate
 * @returns {object} - The validated environment variables
 * @throws {ValidationError} - If environment variables are invalid
 */
export function validateEnvironmentVariables(env) {
  if (!env || typeof env !== 'object') {
    throw new ValidationError('Environment variables must be an object', { provided: typeof env });
  }
  
  // Check that all values are strings
  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string') {
      throw new ValidationError(
        `Environment variable "${key}" value must be a string`,
        { key, type: typeof value }
      );
    }
  }
  
  return env;
}

/**
 * Validates a date string in YYYY-MM-DD format
 * 
 * @param {string} date - Date string to validate
 * @returns {string} - The validated date string
 * @throws {ValidationError} - If date string is invalid
 */
export function validateDateString(date) {
  if (!date) {
    throw new ValidationError('Date string is required');
  }
  
  if (date === 'latest') {
    return date; // Special case for 'latest'
  }
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError(
      'Date must be in YYYY-MM-DD format',
      { provided: date }
    );
  }
  
  // Additional check that the date is valid
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    throw new ValidationError('Invalid date', { provided: date });
  }
  
  // Check if the date is valid for the specified month
  const year = parseInt(date.substring(0, 4), 10);
  // Month in Date() is 0-indexed (0-11), but the parsed month is 1-indexed (1-12)
  const month = parseInt(date.substring(5, 7), 10) - 1;
  const day = parseInt(date.substring(8, 10), 10);
  
  // Get days in the specified month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  if (day <= 0 || day > daysInMonth) {
    throw new ValidationError('Invalid date - day out of range for month', { 
      provided: date,
      maxDaysInMonth: daysInMonth
    });
  }
  
  return date;
}

/**
 * Parses and validates JSON input
 * 
 * @param {string} jsonString - JSON string to parse and validate
 * @returns {object} - Parsed JSON object
 * @throws {ValidationError} - If JSON string is invalid
 */
export function parseAndValidateJson(jsonString) {
  if (!jsonString) {
    throw new ValidationError('JSON string is required');
  }
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new ValidationError(
      'Invalid JSON format',
      { error: error.message, input: jsonString }
    );
  }
}
