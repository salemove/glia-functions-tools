#!/usr/bin/env node

/**
 * CLI Installation Helper
 * 
 * This script guides users through installing the Glia Functions CLI tools globally
 * to enable the `glia-functions` and `glia` commands to be used from anywhere.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the current script's directory
const __dirname = dirname(fileURLToPath(import.meta.url));

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Print the banner
console.log(`${colors.cyan}
 ██████╗ ██╗     ██╗ █████╗     ███████╗██╗   ██╗███╗   ██╗ ██████╗████████╗██╗ ██████╗ ███╗   ██╗███████╗
██╔════╝ ██║     ██║██╔══██╗    ██╔════╝██║   ██║████╗  ██║██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║██╔════╝
██║  ███╗██║     ██║███████║    █████╗  ██║   ██║██╔██╗ ██║██║        ██║   ██║██║   ██║██╔██╗ ██║███████╗
██║   ██║██║     ██║██╔══██║    ██╔══╝  ██║   ██║██║╚██╗██║██║        ██║   ██║██║   ██║██║╚██╗██║╚════██║
╚██████╔╝███████╗██║██║  ██║    ██║     ╚██████╔╝██║ ╚████║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║███████║
 ╚═════╝ ╚══════╝╚═╝╚═╝  ╚═╝    ╚═╝      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝
                                                                                                           
          ██╗███╗   ██╗███████╗████████╗ █████╗ ██╗     ██╗     ███████╗██████╗                           
          ██║████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██║     ██║     ██╔════╝██╔══██╗                          
          ██║██╔██╗ ██║███████╗   ██║   ███████║██║     ██║     █████╗  ██████╔╝                          
          ██║██║╚██╗██║╚════██║   ██║   ██╔══██║██║     ██║     ██╔══╝  ██╔══██╗                          
          ██║██║ ╚████║███████║   ██║   ██║  ██║███████╗███████╗███████╗██║  ██║                          
          ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝                          
${colors.reset}`);

console.log(`${colors.green}This script will install the Glia Functions CLI globally on your system.${colors.reset}`);
console.log(`${colors.green}After installation, you can use the 'glia-functions' and 'glia' commands from anywhere.${colors.reset}\n`);

// Check if we have the required files
const packageJsonPath = join(__dirname, 'package.json');
const cliPath = join(__dirname, 'bin', 'glia-functions.js');

if (!existsSync(packageJsonPath) || !existsSync(cliPath)) {
  console.error(`${colors.red}Error: Required files not found. Make sure you are running this script from the root of the Glia Functions Tools repository.${colors.reset}`);
  process.exit(1);
}

// Ensure bin file is executable
try {
  execSync(`chmod +x "${cliPath}"`, { stdio: 'inherit' });
} catch (error) {
  console.error(`${colors.yellow}Warning: Could not set execute permissions on the CLI script. You may need to do this manually: chmod +x "${cliPath}"${colors.reset}`);
}

// Always install/update dependencies to ensure they're current
console.log(`${colors.cyan}Installing/updating local dependencies...${colors.reset}`);
try {
  // Always use npm install to handle overrides in package.json
  execSync('npm install', { stdio: 'inherit', cwd: __dirname });
  
  // Fix any non-breaking vulnerabilities automatically
  try {
    console.log(`${colors.cyan}Fixing non-breaking security vulnerabilities...${colors.reset}`);
    execSync('npm audit fix --silent', { stdio: 'inherit', cwd: __dirname });
  } catch (auditError) {
    // Audit fix failures shouldn't stop the installation process
    console.log(`${colors.yellow}Note: Some vulnerabilities may require manual review. Run 'npm audit' for details.${colors.reset}`);
  }
  
  console.log(`${colors.green}✓ Dependencies installed successfully!${colors.reset}\n`);
} catch (error) {
  console.error(`\n${colors.red}Dependency installation failed:${colors.reset}`, error.message);
  console.error(`${colors.yellow}Please run 'npm install' manually before proceeding.${colors.reset}`);
  process.exit(1);
}

// Run the global installation
console.log(`${colors.cyan}Installing CLI globally...${colors.reset}`);
try {
  execSync('npm install -g .', { stdio: 'inherit', cwd: __dirname });
  
  console.log(`\n${colors.green}✓ Installation successful!${colors.reset}\n`);
  console.log(`You can now use the CLI with either of these commands from anywhere:`);
  console.log(`  ${colors.cyan}glia-functions${colors.reset}     - Full command name`);
  console.log(`  ${colors.cyan}glia${colors.reset}               - Shorter alias\n`);
  
  console.log(`To verify the installation, try running:`);
  console.log(`  ${colors.cyan}glia-functions --version${colors.reset}\n`);
  
  console.log(`To get started with the interactive CLI, simply run:`);
  console.log(`  ${colors.cyan}glia${colors.reset}\n`);
  
  console.log(`For a list of available commands, run:`);
  console.log(`  ${colors.cyan}glia-functions --help${colors.reset}\n`);
  
  console.log(`${colors.yellow}Note:${colors.reset} To uninstall the CLI globally, run: ${colors.cyan}npm uninstall -g glia-functions-tools${colors.reset}`);
} catch (error) {
  console.error(`\n${colors.red}Installation failed:${colors.reset}`, error.message);
  console.error(`\n${colors.yellow}You may need to run this command with sudo/administrator privileges.${colors.reset}`);
  console.error(`Try: ${colors.cyan}sudo npm install -g .${colors.reset}`);
  process.exit(1);
}