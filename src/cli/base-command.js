/**
 * Base Command Class
 * 
 * This module provides a base command class for standardizing the Glia Functions CLI commands.
 * It handles common patterns for:
 * - CLI argument parsing using Commander.js
 * - Error handling
 * - API client creation
 * - Consistent output formatting
 * 
 * Commands should extend this base class to ensure consistent behavior across the CLI.
 */

import { Command } from 'commander';
import { getApiConfig } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';
import { handleError } from './error-handler.js';
import chalk from 'chalk';

export class BaseCommand {
  /**
   * Initialize the command
   * 
   * @param {string} name - Command name
   * @param {string} description - Command description
   */
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.command = new Command(name).description(description);
  }

  /**
   * Add an option to the command
   * 
   * @param {string} flags - Option flags (e.g., '-n, --name <name>')
   * @param {string} description - Option description
   * @param {*} [defaultValue] - Default value for the option
   * @returns {BaseCommand} The command instance for chaining
   */
  option(flags, description, defaultValue) {
    this.command.option(flags, description, defaultValue);
    return this;
  }

  /**
   * Add a required option to the command
   * 
   * @param {string} flags - Option flags (e.g., '--name <name>')
   * @param {string} description - Option description
   * @param {*} [defaultValue] - Default value for the option
   * @returns {BaseCommand} The command instance for chaining
   */
  requiredOption(flags, description, defaultValue) {
    this.command.requiredOption(flags, description, defaultValue);
    return this;
  }

  /**
   * Create an API client with the current configuration
   * 
   * @returns {Promise<GliaApiClient>} Configured API client
   */
  async createApiClient() {
    const apiConfig = await getApiConfig();
    return new GliaApiClient(apiConfig);
  }

  /**
   * Format output as JSON
   * 
   * @param {Object} data - Data to format
   * @returns {string} Formatted JSON string
   */
  formatJson(data) {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Format output as a table
   * 
   * @param {Array<Object>} data - Array of objects to display
   * @param {Array<string>} [columns] - Columns to include
   * @returns {string} Formatted table string
   */
  formatTable(data, columns) {
    if (!data || data.length === 0) {
      return 'No data available';
    }
    
    // If columns not specified, use all keys from first item
    const keys = columns || Object.keys(data[0]);
    
    // Get maximum width for each column
    const widths = {};
    keys.forEach(key => {
      widths[key] = key.length;
      data.forEach(item => {
        const value = String(item[key] || '');
        if (value.length > widths[key]) {
          widths[key] = value.length;
        }
      });
    });
    
    // Build header
    let table = keys.map(key => key.padEnd(widths[key])).join(' | ');
    
    // Add separator
    table += '\n' + keys.map(key => '-'.repeat(widths[key])).join('-+-');
    
    // Add rows
    data.forEach(item => {
      table += '\n' + keys.map(key => {
        const value = String(item[key] || '');
        return value.padEnd(widths[key]);
      }).join(' | ');
    });
    
    return table;
  }

  /**
   * Print success message
   * 
   * @param {string} message - Success message
   */
  success(message) {
    console.log(chalk.green(`✓ ${message}`));
  }

  /**
   * Print info message
   * 
   * @param {string} message - Info message
   */
  info(message) {
    console.log(chalk.blue(`ℹ ${message}`));
  }

  /**
   * Print warning message
   * 
   * @param {string} message - Warning message
   */
  warning(message) {
    console.log(chalk.yellow(`⚠ ${message}`));
  }

  /**
   * Print error message
   * 
   * @param {string} message - Error message
   */
  error(message) {
    console.error(chalk.red(`✗ ${message}`));
  }

  /**
   * Define the action to execute when the command is run
   * 
   * @param {Function} actionFn - Action function
   * @returns {BaseCommand} The command instance for chaining
   */
  action(actionFn) {
    this.command.action(async (...args) => {
      try {
        await actionFn(...args);
      } catch (err) {
        handleError(err);
        process.exit(1);
      }
    });
    return this;
  }

  /**
   * Parse command line arguments and execute the command
   * 
   * @param {Array<string>} argv - Command line arguments
   */
  parse(argv) {
    this.command.parse(argv);
  }

  /**
   * Get the Commander.js command instance
   * 
   * @returns {Command} Commander.js command
   */
  getCommand() {
    return this.command;
  }
}

export default BaseCommand;
