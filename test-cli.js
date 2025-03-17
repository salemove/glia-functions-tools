/**
 * Simple test script for the Glia Functions CLI
 */

import { routeCommand } from './src/cli/command-router.js';
import chalk from 'chalk';

console.log(chalk.bold('Testing Glia Functions CLI command routing'));
console.log('----------------------------------------------');

// Mock a command execution
async function testCommandRouting() {
  try {
    console.log(chalk.cyan('Testing command routing with list-functions command'));
    await routeCommand('list-functions', { detailed: true });
    console.log(chalk.green('✓ Command routing test completed'));
  } catch (error) {
    console.error(chalk.red(`✗ Command routing test failed: ${error.message}`));
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
  }
}

// Run the test
testCommandRouting().catch(error => {
  console.error(chalk.red(`Unexpected error: ${error.message}`));
  process.exit(1);
});
