/**
 * Export Handler Setup Wizard
 * 
 * This module provides an interactive wizard for setting up export handlers,
 * guiding users through the process of creating a function to handle
 * Glia export events.
 */

import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { getExportEventTypes } from '../utils/export-events-registry.js';

/**
 * Run the export handler setup wizard
 * 
 * @param {Object} options - Initial options
 * @returns {Promise<Object>} Wizard result
 */
export async function runExportWizard(options = {}) {
  try {
    console.log(chalk.blue('Export Handler Setup Wizard'));
    console.log('This wizard will guide you through setting up a handler for Glia export events.\n');
    
    // Step 1: Select export event type
    const eventTypes = await getExportEventTypes(true);
    const eventChoices = Object.entries(eventTypes).map(([key, metadata]) => ({
      name: metadata.displayName,
      value: key,
      description: metadata.description
    }));
    
    eventChoices.push({
      name: '(Cancel)',
      value: 'cancel'
    });
    
    const eventType = await select({
      message: 'Select the export event type to handle:',
      choices: eventChoices
    });
    
    if (eventType === 'cancel') {
      return { canceled: true };
    }
    
    // Step 2: Project configuration
    const projectName = await input({
      message: 'Project name:',
      default: `${eventType}-handler`,
      validate: (input) => input ? true : 'Project name is required'
    });
    
    // Step 3: Forwarding configuration
    const needsForwarding = await confirm({
      message: 'Do you need to forward events to another service?',
      default: false
    });
    
    let forwardingUrl = '';
    let authType = 'none';
    
    if (needsForwarding) {
      forwardingUrl = await input({
        message: 'Forwarding URL:',
        validate: (input) => {
          if (!input) return 'URL is required';
          try {
            new URL(input);
            return true;
          } catch (e) {
            return 'Please enter a valid URL';
          }
        }
      });
      
      authType = await select({
        message: 'Authentication method:',
        choices: [
          { name: 'None', value: 'none' },
          { name: 'API Key (Header)', value: 'api-key' },
          { name: 'Bearer Token', value: 'bearer' },
          { name: 'Basic Auth', value: 'basic' }
        ]
      });
    }
    
    // Step 4: Handling options
    const needsFiltering = await confirm({
      message: 'Do you want to filter out PII data?',
      default: true
    });
    
    // Step 5: Additional options
    const includeTypescript = await confirm({
      message: 'Include TypeScript definitions?',
      default: true
    });
    
    // Compile all options
    const wizardResult = {
      eventType,
      projectName,
      forwarding: needsForwarding ? {
        url: forwardingUrl,
        authType
      } : null,
      filtering: needsFiltering,
      typescript: includeTypescript,
      canceled: false
    };
    
    // Summary
    console.log('\n' + chalk.green('Export Handler Configuration:'));
    console.log(`Event type: ${eventTypes[eventType].displayName}`);
    console.log(`Project name: ${projectName}`);
    if (needsForwarding) {
      console.log(`Forwarding to: ${forwardingUrl}`);
      console.log(`Authentication: ${authType}`);
    }
    console.log(`PII filtering: ${needsFiltering ? 'Enabled' : 'Disabled'}`);
    console.log(`TypeScript definitions: ${includeTypescript ? 'Included' : 'Not included'}`);
    
    const confirmChoice = await confirm({
      message: 'Proceed with this configuration?',
      default: true
    });
    
    if (!confirmChoice) {
      return { canceled: true };
    }
    
    return wizardResult;
  } catch (error) {
    console.error('Error in export wizard:', error);
    return { canceled: true, error };
  }
}