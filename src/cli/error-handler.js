/**
 * CLI error handler
 * 
 * Provides consistent error display for the CLI interface with detailed context
 * and troubleshooting information
 */

import chalk from 'chalk';
import { 
  GliaError, 
  ValidationError, 
  AuthenticationError, 
  ConfigurationError, 
  FunctionError,
  NetworkError,
  RateLimitError 
} from '../lib/errors.js';

/**
 * Format and display troubleshooting hints
 * 
 * @param {string[]} hints - Array of troubleshooting hints
 */
function displayTroubleshootingHints(hints) {
  if (!hints || hints.length === 0) return;
  
  console.error(chalk.yellow('\n⚠️  Troubleshooting:'));
  hints.forEach(hint => {
    console.error(chalk.yellow('  • ') + hint);
  });
}

/**
 * Format and display request details for network-related errors
 * 
 * @param {GliaError} error - Error with request details
 * @param {boolean} verbose - Whether to show verbose error details
 */
function displayRequestDetails(error, verbose) {
  if (!verbose) return;
  
  console.error(chalk.gray('\n📡 Request Information:'));
  
  if (error.endpoint) {
    console.error(chalk.gray(`  Endpoint: ${error.method || 'GET'} ${error.endpoint}`));
  }
  
  if (error.statusCode) {
    console.error(chalk.gray(`  Status Code: ${error.statusCode}`));
  }
  
  if (error.requestId) {
    console.error(chalk.gray(`  Request ID: ${error.requestId}`));
  }
  
  if (error.timestamp) {
    console.error(chalk.gray(`  Timestamp: ${error.timestamp}`));
  }
  
  if (error.requestPayload && verbose) {
    console.error(chalk.gray('  Request Payload:'));
    console.error(chalk.gray('  ' + JSON.stringify(error.requestPayload, null, 2)
      .replace(/\n/g, '\n  ')));
  }
  
  if (error.responseBody && verbose) {
    console.error(chalk.gray('  Response Body:'));
    const response = typeof error.responseBody === 'string' 
      ? error.responseBody 
      : JSON.stringify(error.responseBody, null, 2);
    console.error(chalk.gray('  ' + response.replace(/\n/g, '\n  ')));
  }
}

/**
 * Display validation-specific error information
 * 
 * @param {ValidationError} error - Validation error with field details
 */
function displayValidationDetails(error) {
  if (error.field) {
    console.error(chalk.yellow(`  Field: ${error.field}`));
  }
  
  if (error.provided !== undefined) {
    const providedValue = typeof error.provided === 'object' 
      ? JSON.stringify(error.provided) 
      : String(error.provided);
    console.error(chalk.yellow(`  Provided: ${providedValue}`));
  }
  
  if (error.expected !== undefined) {
    const expectedValue = typeof error.expected === 'object' 
      ? JSON.stringify(error.expected) 
      : String(error.expected);
    console.error(chalk.yellow(`  Expected: ${expectedValue}`));
  }
}

/**
 * Handle an error in the CLI
 * 
 * @param {Error} error - The error to handle
 * @param {boolean} verbose - Whether to show verbose error details
 */
export function handleError(error, verbose = false) {
  if (error instanceof ValidationError) {
    console.error(chalk.red('❌ Validation Error:'), error.message);
    displayValidationDetails(error);
    
    // Display troubleshooting hints if any
    if (verbose && error.details) {
      console.error(chalk.yellow('\nDetails:'));
      console.error(chalk.yellow(JSON.stringify(error.details, null, 2)));
    }
    
    process.exit(1);
  }
  
  if (error instanceof AuthenticationError) {
    console.error(chalk.red('🔒 Authentication Error:'), error.message);
    
    // Display troubleshooting hints
    displayTroubleshootingHints(error.getTroubleshootingHints?.() || [
      'Try running: node index.js',
      'Then select "Authenticate CLI" from the main menu.'
    ]);
    
    // Display request details if relevant
    displayRequestDetails(error, verbose);
    
    process.exit(1);
  }
  
  if (error instanceof ConfigurationError) {
    console.error(chalk.red('⚙️  Configuration Error:'), error.message);
    
    // Display troubleshooting hints
    displayTroubleshootingHints(error.getTroubleshootingHints?.() || [
      'Try running: node index.js',
      'Then select "Setup project" from the main menu.'
    ]);
    
    if (error.missingFields?.length) {
      console.error(chalk.yellow('\nMissing Fields:'));
      error.missingFields.forEach(field => {
        console.error(chalk.yellow(`  • ${field}`));
      });
    }
    
    if (error.invalidFields?.length) {
      console.error(chalk.yellow('\nInvalid Fields:'));
      error.invalidFields.forEach(field => {
        console.error(chalk.yellow(`  • ${field}`));
      });
    }
    
    if (error.configFile) {
      console.error(chalk.yellow(`\nConfiguration File: ${error.configFile}`));
    }
    
    process.exit(1);
  }

  if (error instanceof FunctionError) {
    console.error(chalk.red('🛑 Function Error:'), error.message);
    
    if (error.functionId) {
      console.error(chalk.yellow(`Function ID: ${error.functionId}`));
    }
    
    if (error.versionId) {
      console.error(chalk.yellow(`Version ID: ${error.versionId}`));
    }
    
    if (error.operation) {
      console.error(chalk.yellow(`Operation: ${error.operation}`));
    }
    
    // Display troubleshooting hints
    displayTroubleshootingHints(error.getTroubleshootingHints?.());
    
    // Display request details if relevant
    displayRequestDetails(error, verbose);
    
    process.exit(1);
  }
  
  if (error instanceof RateLimitError) {
    console.error(chalk.red('⏱️  Rate Limit Error:'), error.message);
    
    if (error.retryAfter) {
      console.error(chalk.yellow(`Retry after: ${error.retryAfter} seconds`));
    }
    
    if (error.limit) {
      console.error(chalk.yellow(`Rate limit: ${error.limit} requests`));
    }
    
    // Display troubleshooting hints
    displayTroubleshootingHints(error.getTroubleshootingHints?.());
    
    // Display request details if relevant
    displayRequestDetails(error, verbose);
    
    process.exit(1);
  }
  
  if (error instanceof NetworkError) {
    console.error(chalk.red('📶 Network Error:'), error.message);
    
    // Display troubleshooting hints
    displayTroubleshootingHints(error.getTroubleshootingHints?.() || [
      'Check your internet connection and try again.',
      'Verify the API endpoint is correct.',
      error.retryable ? 'This error is likely temporary. Try again later.' : null
    ].filter(Boolean));
    
    // Display request details if relevant
    displayRequestDetails(error, verbose);
    
    process.exit(1);
  }
  
  if (error instanceof GliaError) {
    console.error(chalk.red(`❗ Error (${error.code}):`), error.message);
    
    // Use formatWithContext if available, otherwise display basic details
    if (error.formatWithContext && verbose) {
      const formattedError = error.formatWithContext();
      console.error(chalk.gray('\nError Context:'));
      console.error(chalk.gray(formattedError.split('\n').slice(1).join('\n')));
    } else if (error.details && verbose) {
      console.error(chalk.yellow('\nDetails:'));
      console.error(chalk.yellow(JSON.stringify(error.details, null, 2)));
    }
    
    // Display request details if relevant
    displayRequestDetails(error, verbose);
    
    process.exit(1);
  }
  
  // Unexpected errors
  console.error(chalk.red('💥 Unexpected Error:'), error.message);
  if (verbose) {
    console.error(chalk.gray('\nStack Trace:'));
    console.error(chalk.gray(error.stack));
  } else {
    console.error(chalk.yellow('\nFor more details, run with --verbose flag.'));
  }
  process.exit(1);
}

/**
 * Display warning messages consistently
 * 
 * @param {string} message - Warning message to display
 */
export function showWarning(message) {
  console.warn(chalk.yellow('⚠️  Warning:'), message);
}

/**
 * Display success messages consistently
 * 
 * @param {string} message - Success message to display
 */
export function showSuccess(message) {
  console.log(chalk.green('✅ Success:'), message);
}

/**
 * Display info messages consistently
 * 
 * @param {string} message - Info message to display
 */
export function showInfo(message) {
  console.log(chalk.blue('ℹ️  Info:'), message);
}

/**
 * Display error messages consistently
 * 
 * @param {string} message - Error message to display
 */
export function showError(message) {
  console.error(chalk.red('❌ Error:'), message);
}

/**
 * Display debug messages (only if verbose mode)
 * 
 * @param {string} message - Debug message to display
 * @param {boolean} verbose - Whether to show debug messages
 */
export function showDebug(message, verbose = false) {
  if (verbose) {
    console.log(chalk.gray('🔍 Debug:'), message);
  }
}

/**
 * Format error details for display
 * 
 * @param {Error} error - Error to format
 * @param {boolean} verbose - Whether to include detailed information
 * @returns {string} Formatted error message
 */
export function formatErrorForDisplay(error, verbose = false) {
  if (error instanceof GliaError && error.formatWithContext) {
    return error.formatWithContext();
  }
  
  let output = error.message;
  
  if (verbose && error instanceof GliaError) {
    if (error.code) {
      output += `\nCode: ${error.code}`;
    }
    
    if (error.details) {
      output += `\nDetails: ${JSON.stringify(error.details, null, 2)}`;
    }
  }
  
  if (verbose && error.stack) {
    output += `\n${error.stack.split('\n').slice(1).join('\n')}`;
  }
  
  return output;
}
