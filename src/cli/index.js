/**
 * Main CLI entry point for Glia Functions CLI
 * 
 * Provides a modern, consistent interface for interacting with Glia Functions
 */

import colorizer from '../utils/colorizer.js';
import { input, select, confirm, editor } from '@inquirer/prompts';
import * as fs from 'fs';
import { execSync } from 'child_process';

import { 
  getCliVersion, 
  loadConfig, 
  updateEnvFile, 
  updateGlobalConfig, 
  getAuthConfig, 
  getApiConfig, 
  hasValidBearerToken, 
  validateToken,
  listProfiles,
  createProfile,
  updateProfile,
  switchProfile,
  deleteProfile
} from '../lib/config.js';
import GliaApiClient from '../lib/api.js';
import { handleError, showSuccess, showInfo, showWarning, showError } from './error-handler.js';
import { parseAndValidateJson } from '../lib/validation.js';
import { AuthenticationError, ConfigurationError, NetworkError } from '../lib/errors.js';
import { routeCommand } from './command-router.js';
import { CLISetupExportHandler } from './setup-export-handler.js';

// ASCII art banner with version
const separator = '============================='
const CLIIntro = () => {
  console.log(colorizer.hex('#7C19DE').bold(` #####                     #######                                                   
#     # #      #   ##      #       #    # #    #  ####  ##### #  ####  #    #  ####  
#       #      #  #  #     #       #    # ##   # #    #   #   # #    # ##   # #      
#  #### #      # #    #    #####   #    # # #  # #        #   # #    # # #  #  ####  
#     # #      # ######    #       #    # #  # # #        #   # #    # #  # #      # 
#     # #      # #    #    #       #    # #   ## #    #   #   # #    # #   ## #    # 
 #####  ###### # #    #    #        ####  #    #  ####    #   #  ####  #    #  ####  `))
  console.log(colorizer.italic(`v${getCliVersion()}`))
  console.log(separator)
}

/**
 * Main menu for the CLI
 */
const CLIMainMenu = async () => {
  let choices = [];
  
  // If we have a bearer token, prioritize the build functions option
  if (process.env.GLIA_BEARER_TOKEN && process.env.GLIA_SITE_ID) {
    choices.push({
      name: 'Manage & build functions',
      value: 'build',
      description: 'Build or update a function',
    });
  }
  
  // Always offer setup, but it's not the first option when we have a token
  choices.push({
    name: 'Setup project',
    value: 'setup',
    description: 'Setup the environment for further requests and generate a bearer token',
  });

  if (process.env.GLIA_SITE_ID) {
    choices.push({
      name: 'Authenticate CLI',
      value: 'auth',
      description: '(Re)Generate a new bearer token',
    });
    
    // Add the change site option when we have credentials
    choices.push({
      name: 'Change active site',
      value: 'changeSite',
      description: 'Switch to a different site within the current profile',
    });
  }
  
  // Profile management
  choices.push({
    name: 'Manage profiles',
    value: 'profiles',
    description: 'Create, switch between, and manage configuration profiles',
  });

  choices.push({
    name: '(Exit)',
    value: 'exit'
  });

  try {
    const answer = await select({
      message: 'Select action:',
      choices
    });
    
    switch(answer) {
      case 'setup': await CLISetup(); return false;
      case 'auth': await CLIAuth();  return false;
      case 'build': await CLIBuildMenu(); return false;
      case 'profiles': await CLIProfileMenu(); return false;
      case 'changeSite': await CLIChangeSite(); return false;
      case 'exit': 
        console.log(colorizer.green('Exiting Glia Functions CLI. Goodbye!'));
        process.exit(0); // Explicitly exit with success code
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * CLI setup wizard for configuring environment variables
 */
const CLISetup = async () => {
  try {
    const APIKey = await input({  
      name: 'APIKey',
      message: 'User API Key ID:'
    });

    const APISecret = await input({  
      name: 'APISecret',
      message: 'User API Key Secret:'
    });
      
    const SiteID = await input({  
      type: 'input',
      name: 'SiteID',
      message: 'Site ID:'
    });

    const Environment = await select({
      message: 'Choose environment:',
      choices: [{ 
        name: 'Production',
        value: 'production'
      }, {
        name: 'Beta',
        value: 'beta'
      }]
    });
    
    // Profile selection - default or custom profile
    const availableProfiles = listProfiles();
    
    // Get current profile name
    const currentProfile = process.env.GLIA_PROFILE || 'default';
    
    // Ask if the user wants to save to the current profile or a different one
    const profileChoices = [];
    
    // Always include current profile as first option
    profileChoices.push({
      name: `Current profile (${currentProfile})`,
      value: currentProfile
    });
    
    // Add option to create new profile
    profileChoices.push({
      name: 'Create new profile...',
      value: 'new'
    });
    
    // Add other existing profiles
    const otherProfiles = availableProfiles.filter(p => p !== currentProfile);
    if (otherProfiles.length > 0) {
      otherProfiles.forEach(profile => {
        profileChoices.push({
          name: profile,
          value: profile
        });
      });
    }
    
    const selectedProfileOption = await select({
      message: 'Save to profile:',
      choices: profileChoices
    });
    
    // Handle creating a new profile
    let targetProfile = selectedProfileOption;
    if (selectedProfileOption === 'new') {
      const newProfileName = await input({
        message: 'Enter new profile name:',
        validate: (input) => {
          if (!input) return 'Profile name is required';
          if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
            return 'Profile name can only contain letters, numbers, dashes, and underscores';
          }
          if (availableProfiles.includes(input)) {
            return `Profile '${input}' already exists`;
          }
          return true;
        }
      });
      
      // Create the new profile
      await createProfile(newProfileName);
      
      targetProfile = newProfileName;
    }
    
    const confirmDetails = await confirm({ 
      message: `Do you want to proceed with the above details? This will ${targetProfile === currentProfile ? 'overwrite your current settings' : `save to profile '${targetProfile}'`}.` 
    });

    if (confirmDetails) {
      // Generate URL based on environment
      const url = Environment === 'beta' ? 'https://api.beta.glia.com' : 'https://api.glia.com';
      
      try {
        // Create a temporary API client to generate token
        const tokenInfo = await createBearerToken(APIKey, APISecret, url);
        
        // Prepare configuration updates
        const configUpdates = {
          'GLIA_KEY_ID': APIKey,
          'GLIA_KEY_SECRET': APISecret,
          'GLIA_SITE_ID': SiteID,
          'GLIA_API_URL': url,
          'GLIA_BEARER_TOKEN': tokenInfo.token,
          'GLIA_TOKEN_EXPIRES_AT': tokenInfo.expiresAt
        };
        
        // Save to local .env
        let env = ``;
        env += `GLIA_KEY_ID = ${APIKey}\n`;
        env += `GLIA_KEY_SECRET = ${APISecret}\n`;
        env += `GLIA_SITE_ID = ${SiteID}\n`;
        env += `GLIA_API_URL = ${url}\n`;
        env += `GLIA_BEARER_TOKEN = ${tokenInfo.token}\n`;
        env += `GLIA_TOKEN_EXPIRES_AT = ${tokenInfo.expiresAt}\n`;
        await fs.writeFileSync('.env', env);
        
        // Update process.env variables to ensure they're available immediately in the current session
        process.env.GLIA_KEY_ID = APIKey;
        process.env.GLIA_KEY_SECRET = APISecret;
        process.env.GLIA_SITE_ID = SiteID;
        process.env.GLIA_API_URL = url;
        process.env.GLIA_BEARER_TOKEN = tokenInfo.token;
        process.env.GLIA_TOKEN_EXPIRES_AT = tokenInfo.expiresAt;
        
        // If target profile is not default or current profile,
        // ask if they want to switch to it
        let shouldSwitchProfile = false;
        if (targetProfile !== currentProfile) {
          shouldSwitchProfile = await confirm({
            message: `Switch to profile '${targetProfile}' now?`,
            default: true
          });
        }
        
        if (targetProfile !== 'default') {
          // Save to selected profile
          await updateProfile(targetProfile, configUpdates);
          showSuccess(`Configuration saved to profile '${targetProfile}'`);
          
          if (shouldSwitchProfile) {
            await switchProfile(targetProfile);
            showInfo(`Switched to profile '${targetProfile}'`);
          }
        } else {
          // Default profile - save to global config
          await updateGlobalConfig(configUpdates);
          showSuccess('Configuration saved globally');
        }
        
        showInfo('Settings also written to .env file for local project use.');

        await CLIMainMenu();
        return false;
      } catch (error) {
        handleError(error);
      }
    } else {
      showInfo('Setup canceled.');
      await CLIMainMenu();
      return false;
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * Generate a bearer token using API credentials
 * 
 * @param {string} keyId - API key ID
 * @param {string} keySecret - API key secret
 * @param {string} apiUrl - API URL
 * @param {string} siteId - Site ID to verify token permissions
 * @returns {Promise<Object>} Object containing token and expiration
 */
async function createBearerToken(keyId, keySecret, apiUrl, siteId) {
  try {
    if (!keyId || !keySecret) {
      throw new AuthenticationError('API key ID and secret are required');
    }
    
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    
    // Show that we're attempting to generate a token
    console.log(colorizer.blue(`Requesting token from ${apiUrl}/operator_authentication/tokens...`));
    
    const response = await fetch(`${apiUrl}/operator_authentication/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.salemove.v1+json'
      },
      body: JSON.stringify({
        api_key_id: keyId,
        api_key_secret: keySecret
      })
    });
    
    if (!response.ok) {
      throw new AuthenticationError(`Authentication failed (${response.status}): ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Calculate expiration time
    // The Glia API provides tokens that expire after 1 hour (3600 seconds)
    // If the API doesn't provide an expiration time, we'll set a default of 55 minutes
    // to be safe and allow for refresh before actual expiration
    const expiresInMs = data.expires_in ? data.expires_in * 1000 : 55 * 60 * 1000;
    const expiresAt = Date.now() + expiresInMs;
    
    const tokenInfo = {
      token: data.token,
      expiresAt
    };
    
    // If site ID was provided, validate that the token has access to it
    if (siteId) {
      try {
        console.log(colorizer.blue(`Validating token has access to site ${siteId}...`));
        
        // Test that the token has access to the requested site
        const siteResponse = await fetch(`${apiUrl}/sites/${siteId}`, {
          headers: {
            'Authorization': `Bearer ${tokenInfo.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json'
          }
        });
        
        if (!siteResponse.ok) {
          console.log(colorizer.yellow(`Warning: Token was generated but does not have access to site ${siteId}`));
          console.log(colorizer.yellow(`API returned: ${siteResponse.status} ${siteResponse.statusText}`));
          
          if (siteResponse.status === 403) {
            console.log(colorizer.yellow('The API key may not have permissions for this site.'));
            
            // Try to get a list of sites that this token does have access to
            try {
              console.log(colorizer.blue('Checking which sites this token has access to...'));
              const sitesResponse = await fetch(`${apiUrl}/sites`, {
                headers: {
                  'Authorization': `Bearer ${tokenInfo.token}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/vnd.salemove.v1+json'
                }
              });
              
              if (sitesResponse.ok) {
                const sitesData = await sitesResponse.json();
                
                if (sitesData.sites && sitesData.sites.length > 0) {
                  console.log(colorizer.green(`Found ${sitesData.sites.length} sites that this token has access to.`));
                  
                  // Show the first few sites
                  const sitesToShow = sitesData.sites.slice(0, 3);
                  sitesToShow.forEach((site) => {
                    console.log(colorizer.green(`- ${site.id}: ${site.name || '[No name]'}`));
                  });
                  
                  if (sitesData.sites.length > 3) {
                    console.log(colorizer.green(`  and ${sitesData.sites.length - 3} more...`));
                  }
                  
                  // Store available sites on tokenInfo
                  tokenInfo.availableSites = sitesData.sites;
                  
                  // If this is the first site, suggest using it automatically
                  if (sitesData.sites.length === 1) {
                    const firstSite = sitesData.sites[0];
                    tokenInfo.suggestedSiteId = firstSite.id;
                    console.log(colorizer.blue(`Suggest using site ID: ${firstSite.id}`));
                  } else {
                    console.log(colorizer.blue('You can use one of these site IDs for this profile.'));
                  }
                } else {
                  console.log(colorizer.yellow('This token does not have access to any sites.'));
                }
              }
            } catch (sitesError) {
              console.log(colorizer.yellow(`Could not fetch available sites: ${sitesError.message}`));
            }
          }
        } else {
          console.log(colorizer.green(`✓ Token has confirmed access to site ${siteId}`));
        }
      } catch (validationError) {
        console.log(colorizer.yellow(`Warning: Could not validate token access to site: ${validationError.message}`));
      }
    }
    
    return tokenInfo;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError(`Failed to generate bearer token: ${error.message}`);
  }
}

/**
 * Authenticate the CLI by generating a new bearer token
 */
const CLIAuth = async () => {
  try {
    // Make sure we have the required configuration
    const authConfig = await getAuthConfig();
    
    const tokenInfo = await createBearerToken(
      authConfig.keyId, 
      authConfig.keySecret, 
      authConfig.apiUrl || 'https://api.glia.com',
      authConfig.siteId
    );
    
    // Determine where to store the token
    const useGlobalConfig = await confirm({
      message: 'Store this token globally (in ~/.glia-cli/config.env) to use across all projects?',
      default: true
    });
    
    const updateFn = useGlobalConfig ? updateGlobalConfig : updateEnvFile;
    
    await updateFn({
      'GLIA_BEARER_TOKEN': tokenInfo.token,
      'GLIA_TOKEN_EXPIRES_AT': tokenInfo.expiresAt
    });
    
    // If using global config, also update credentials
    if (useGlobalConfig) {
      await updateGlobalConfig({
        'GLIA_KEY_ID': authConfig.keyId,
        'GLIA_KEY_SECRET': authConfig.keySecret,
        'GLIA_SITE_ID': authConfig.siteId,
        'GLIA_API_URL': authConfig.apiUrl
      });
    }
    
    // Update process.env with the new token to ensure it's available immediately in current session
    process.env.GLIA_BEARER_TOKEN = tokenInfo.token;
    process.env.GLIA_TOKEN_EXPIRES_AT = tokenInfo.expiresAt;

    showSuccess('Authentication successful');
    
    if (useGlobalConfig) {
      showInfo(`New bearer token written to global config file. Valid for approximately ${Math.round(tokenInfo.expiresAt - Date.now()) / (1000 * 60 * 60)} hours.`);
    } else {
      showInfo(`New bearer token written to .env file. Valid for approximately ${Math.round(tokenInfo.expiresAt - Date.now()) / (1000 * 60 * 60)} hours.`);
    }

    await CLIMainMenu();
    return false;
  } catch (error) {
    handleError(error);
  }
}

/**
 * Build menu for managing functions
 */
const CLIBuildMenu = async () => {
  try {
    const answer = await select({
      message: 'Select action:',
      choices: [
        {
          name: 'Create new function',
          value: 'CLINewFunction',
          description: 'Create a new Glia Function from scratch.',
        },
        {
          name: 'Initialize project from template',
          value: 'CLIInitProject',
          description: 'Create a complete project structure using a template (including export handlers).',
        },
        {
          name: 'Run function locally',
          value: 'CLIDevFunction',
          description: 'Run a function locally using the development server.',
        },
        {
          name: 'Manage existing functions',
          value: 'CLIListFunctions',
          description: 'Build and deploy function versions, access function logs, see usage statistics.',
        },
        {
          name: 'Deploy project',
          value: 'CLIDeployProject',
          description: 'Deploy multiple functions and applets together with coordinated KV namespaces.',
        },
        {
          name: 'Manage KV Store',
          value: 'CLIManageKvStore',
          description: 'Manage key-value pairs for persisting data across function invocations.',
        },
        {
          name: 'Manage Applets',
          value: 'CLIManageApplets',
          description: 'Create, deploy, and manage applets for Glia.',
        },
        {
          name: '(Back)',
          value: 'back'
        }
      ]
    });

    switch(answer) {
      case 'CLINewFunction': await CLINewFunction(); return false;
      case 'CLIInitProject': await CLIInitProject(); return false;
      case 'CLIDevFunction': await CLIDevFunction(); return false;
      case 'CLIListFunctions': await CLIListFunctions(); return false;
      case 'CLIDeployProject': await CLIDeployProject(); return false;
      case 'CLIManageKvStore': await CLIManageKvStore(); return false;
      case 'CLIManageApplets': await CLIManageApplets(); return false;
      case 'back': await CLIMainMenu(); return false;
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * Initialize a project from template
 */
const CLIInitProject = async () => {
  try {
    // Import the template selector utilities
    const { 
      selectTemplate, 
      collectTemplateVariables, 
      createFromSelectedTemplate 
    } = await import('./template-selector.js');
    
    // Select a template (project or applet)
    const template = await selectTemplate({
      type: ['project', 'applet'],
      message: 'Select a template:',
      showDescription: true
    });
    
    if (!template || template.canceled) {
      await CLIBuildMenu();
      return false;
    }
    
    // Get project name
    const projectName = await input({
      message: 'Project name:',
      default: template.name
    });
    
    const outputDir = await input({
      message: 'Output directory:',
      default: `./${projectName}`
    });
    
    // Collect template variables
    const initialVars = { projectName };
    const variables = await collectTemplateVariables(template, initialVars);
    
    // Create project from selected template
    showInfo(`Creating project from template "${template.displayName}"...`);
    
    const result = await createFromSelectedTemplate({
      template,
      outputDir,
      variables
    });
    
    if (result.files.every(f => f.success)) {
      showSuccess(`Project created successfully in ${outputDir}`);
    } else {
      const successCount = result.files.filter(f => f.success).length;
      const errorCount = result.files.filter(f => !f.success).length;
      showWarning(`Project created with ${errorCount} errors (${successCount} files successful)`);
    }
    
    // Print next steps
    console.log('\nNext steps:');
    console.log(`1. cd ${outputDir}`);
    console.log('2. Review and edit the generated files');
    console.log('3. Follow the instructions in README.md');
    
    // Return to main menu
    await CLIMainMenu();
    return false;
  } catch (error) {
    handleError(error);
  }
}

/**
 * Create a new function
 */
const CLINewFunction = async () => {
  try {
    const functionName = await input({  
      name: 'functionName',
      message: 'Function name:'
    });

    const functionDescription = await input({  
      name: 'functionDescription',
      message: 'Function description:'
    });
    
    // Offer to use a template
    const useTemplate = await confirm({
      message: 'Would you like to use a template for this function?',
      default: true
    });
    
    let selectedTemplate = null;
    let templateObj = null;
    
    if (useTemplate) {
      try {
        // Import the template selector
        const { selectTemplate } = await import('./template-selector.js');
        
        // Select a function template
        templateObj = await selectTemplate({
          type: 'function',
          message: 'Select a function template:',
          showDescription: true
        });
        
        if (templateObj && !templateObj.canceled) {
          selectedTemplate = templateObj.name;
        }
      } catch (error) {
        console.error('Error selecting template:', error);
        showWarning('Failed to load templates. Continuing without a template.');
      }
    }
    
    // Determine output path if using a template
    let outputPath = null;
    if (selectedTemplate) {
      outputPath = await input({
        name: 'outputPath',
        message: 'Output file path:',
        default: `./${functionName.replace(/\s+/g, '-')}.js`
      });
    }

    const confirmDetails = await confirm({ 
      message: `Proceed with ${selectedTemplate ? 'template ' + selectedTemplate : 'no template'}?` 
    });

    if (confirmDetails) {
      // Get API configuration
      const apiConfig = await getApiConfig();
      
      // Create API client
      const api = new GliaApiClient(apiConfig);
      
      // Create function
      const newGliaFunction = await api.createFunction(functionName, functionDescription);
      
      showSuccess('New Glia Function successfully created');
      console.log(newGliaFunction);
      
      // Create from template if selected
      if (selectedTemplate && templateObj) {
        try {
          // Import the template utilities
          const { createFunctionFromTemplate, getTemplateEnvVars } = await import('../utils/unified-template-manager.js');
          const { collectTemplateVariables } = await import('./template-selector.js');
          
          showInfo(`Creating function file from template "${selectedTemplate}"...`);
          
          // Collect any template variables
          const variables = await collectTemplateVariables(templateObj, {
            functionName: functionName
          }, { onlyRequired: true });
          
          // Create function file from template using the unified template manager
          await createFunctionFromTemplate(selectedTemplate, outputPath, variables);
          
          showSuccess(`Function file created at: ${outputPath}`);
          
          // Get recommended environment variables for this template
          const envVars = await getTemplateEnvVars(selectedTemplate);
          if (Object.keys(envVars).length > 0) {
            console.log('\nRecommended environment variables for this template:');
            for (const [key, value] of Object.entries(envVars)) {
              console.log(`- ${key}: ${value}`);
            }
          }
        } catch (error) {
          showWarning(`Error creating function file: ${error.message}`);
        }
      }
      
      await CLIBuildMenu();
      return false;
    } else {
      showInfo('Canceled');
      await CLIBuildMenu();
      return false;
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * Validates that the API configuration looks reasonable
 * This is separate from the basic validation to ensure values exist
 */
function validateApiConfiguration(config) {
  const issues = [];
  
  // Check Site ID format - should be a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(config.siteId)) {
    issues.push(`Site ID doesn't appear to be in the correct format (expected UUID)`);
  }
  
  // Check that API URL looks reasonable
  if (!config.apiUrl.startsWith('http')) {
    issues.push(`API URL doesn't appear to start with http(s)://`);
  }
  
  // Check that bearer token looks reasonable (at least 20 chars)
  if (config.bearerToken && config.bearerToken.length < 20) {
    issues.push(`Bearer token appears too short - may be invalid`);
  }
  
  return issues;
}

/**
 * List available functions
 */
const CLIListFunctions = async () => {
  try {
    console.log(colorizer.blue('Fetching functions list...'));
    
    try {
      // Get API configuration
      let apiConfig = await getApiConfig();
      
      // Get verbose flag from environment or process arguments
      const isVerbose = process.env.GLIA_VERBOSE === 'true' || process.argv.includes('--verbose') || process.argv.includes('-v');
      
      // Check if configuration looks reasonable 
      const configIssues = validateApiConfiguration(apiConfig);
      if (configIssues.length > 0) {
        console.error(colorizer.yellow('⚠️ Configuration warning: Issues found with API configuration:'));
        configIssues.forEach(issue => {
          console.error(colorizer.yellow(`  • ${issue}`));
        });
        console.error(colorizer.yellow('\nYou may need to re-run the setup process to fix these issues.'));
        console.error(colorizer.yellow('Attempting to continue anyway...'));
      }
      
      // Try to retrieve the site details first to validate the token and site ID
      try {
        // Check if we need/can refresh the token first before trying the connection
        if (!apiConfig.bearerToken && apiConfig.keyId && apiConfig.keySecret) {
          try {
            const refreshed = await refreshBearerTokenIfNeeded();
            if (refreshed) {
              showInfo('Bearer token refreshed successfully.');
              
              // Reload config to get the new token
              apiConfig = await getApiConfig();
              showInfo('Using refreshed credentials.');
            }
          } catch (refreshError) {
            console.error(colorizer.yellow('Could not refresh token:'), refreshError.message);
          }
        }
        
        // Only show debug info when in verbose mode
        if (isVerbose) {
          console.log(colorizer.blue('Debug info:'));
          console.log(colorizer.blue('- API URL:'), apiConfig.apiUrl);
          console.log(colorizer.blue('- Site ID:'), apiConfig.siteId);
          console.log(colorizer.blue('- Has API Key ID:'), !!apiConfig.keyId);
          console.log(colorizer.blue('- Has API Key Secret:'), !!apiConfig.keySecret);
          console.log(colorizer.blue('- Has Bearer Token:'), !!apiConfig.bearerToken);
          console.log(colorizer.blue('- Token expires:'), apiConfig.tokenExpiresAt ? new Date(apiConfig.tokenExpiresAt).toLocaleString() : 'n/a');
        }
        
        // Create simple fetch request to test connectivity
        const connectivityTest = await fetch(`${apiConfig.apiUrl}/sites/${apiConfig.siteId}`, {
          headers: {
            'Authorization': `Bearer ${apiConfig.bearerToken || ''}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json'
          }
        });
        
        if (!connectivityTest.ok) {
          throw new Error(`Connection test failed with status ${connectivityTest.status}: ${connectivityTest.statusText}`);
        }
      } catch (connectError) {
        console.error(colorizer.red('Connection test failed:'), connectError.message);
        
        // Check if we have credentials but no valid token or got 401/403 error
        if (apiConfig.keyId && apiConfig.keySecret && 
            ((!apiConfig.bearerToken) || 
             (connectError.message && (connectError.message.includes('401') || connectError.message.includes('403'))))) {
          showWarning('You have API credentials but authentication failed. Attempting to generate a new token...');
          
          try {
            // Create a token using existing credentials
            const tokenInfo = await createBearerToken(
              apiConfig.keyId,
              apiConfig.keySecret,
              apiConfig.apiUrl || 'https://api.glia.com',
              apiConfig.siteId
            );
            
            // Check if we need to update the site ID - if token has sites but doesn't have access to current site ID
            let siteIdUpdated = false;
            if (tokenInfo.availableSites && tokenInfo.availableSites.length > 0) {
              if (tokenInfo.suggestedSiteId) {
                // A single site is available - offer to use it automatically
                const useSuggestedSite = await confirm({
                  message: `Update your profile to use site ID "${tokenInfo.suggestedSiteId}"?`,
                  default: true
                });
                
                if (useSuggestedSite) {
                  apiConfig.siteId = tokenInfo.suggestedSiteId;
                  siteIdUpdated = true;
                  showInfo(`Site ID updated to "${tokenInfo.suggestedSiteId}"`);
                }
              } else if (tokenInfo.availableSites.length > 1) {
                // Multiple sites available - ask user to choose
                const siteChoices = tokenInfo.availableSites.map(site => ({
                  name: `${site.name || site.id}`,
                  value: site.id
                }));
                
                siteChoices.push({
                  name: '(Cancel - keep current site ID)',
                  value: null
                });
                
                showInfo('Select a site ID that your API key has access to:');
                const chosenSiteId = await select({
                  message: 'Choose site ID:',
                  choices: siteChoices
                });
                
                if (chosenSiteId) {
                  apiConfig.siteId = chosenSiteId;
                  siteIdUpdated = true;
                  showInfo(`Site ID updated to "${chosenSiteId}"`);
                }
              }
            }
            
            // Update token in profile
            const currentProfile = process.env.GLIA_PROFILE || 'default';
            const updates = {
              'GLIA_BEARER_TOKEN': tokenInfo.token,
              'GLIA_TOKEN_EXPIRES_AT': tokenInfo.expiresAt
            };
            
            // Also update site ID if it was changed
            if (siteIdUpdated) {
              updates['GLIA_SITE_ID'] = apiConfig.siteId;
              // Update process.env with the new site ID
              process.env.GLIA_SITE_ID = apiConfig.siteId;
            }
            
            if (currentProfile === 'default') {
              await updateGlobalConfig(updates);
            } else {
              await updateProfile(currentProfile, updates);
            }
            
            // Update process.env with the new token
            process.env.GLIA_BEARER_TOKEN = tokenInfo.token;
            process.env.GLIA_TOKEN_EXPIRES_AT = tokenInfo.expiresAt;
            
            showSuccess('Authentication successful. Retrying connection...');
            
            // Try again with the new token - use recursion to avoid duplicating code
            return await CLIListFunctions();
          } catch (authError) {
            showWarning(`Authentication failed: ${authError.message}`);
          }
        }
        
        showWarning('Could not connect to API. Your configuration may be incorrect.');
        
        const rerunSetup = await confirm({
          message: 'Would you like to re-run the setup process?'
        });
        
        if (rerunSetup) {
          await CLISetup();
          return false;
        }
      }
      
      // Create API client
      const api = new GliaApiClient(apiConfig);
      
      try {
        // Get function list
        const list = await api.listFunctions();
        
        if (!list || typeof list !== 'object') {
          showWarning('Received invalid response from API');
          await CLIBuildMenu();
          return false;
        }
        
        if (!list.functions || list.functions.length === 0) {
          showInfo('No functions found');
          await CLIBuildMenu();
          return false;
        }
        
        // Create choices from functions
        let choices = list.functions.map(item => ({
          name: item.name,
          value: item.id,
        }));

        choices.push({
          name: '(Back)',
          value: 'back',
        });

        const functionSelect = await select({
          message: 'Select function:',
          choices
        });

        if (functionSelect === 'back') {
          await CLIBuildMenu();
          return false;
        }

        await CLIFunctionDetailsMenu(functionSelect);
        return false;
      } catch (apiError) {
        // Log detailed error information for debugging
        console.error(colorizer.red('Error while fetching functions:'));
        console.error(colorizer.red(`Error type: ${apiError.constructor.name}`));
        console.error(colorizer.red(`Error message: ${apiError.message}`));
        
        if (apiError.code) {
          console.error(colorizer.red(`Error code: ${apiError.code}`));
        }
        
        if (apiError.details) {
          console.error(colorizer.red('Error details:'), apiError.details);
        }
        
        if (apiError.endpoint) {
          console.error(colorizer.red(`Endpoint: ${apiError.endpoint}`));
        }
        
        if (apiError.statusCode) {
          console.error(colorizer.red(`Status code: ${apiError.statusCode}`));
        }
        
        // Handle different error types
        if (apiError instanceof NetworkError) {
          showWarning('Network error while fetching functions list');
          console.error(colorizer.red('Network Error:'), apiError.message);
        } else if (apiError instanceof AuthenticationError) {
          showWarning('Authentication error - your token may be invalid or expired');
          console.error(colorizer.red('Auth Error:'), apiError.message);
          
          const reAuth = await confirm({
            message: 'Would you like to re-authenticate now?'
          });
          
          if (reAuth) {
            await CLIAuth();
            return false;
          }
        } else {
          showWarning(`API error: ${apiError.message}`);
        }
        
        // Return to build menu instead of exiting
        await CLIBuildMenu();
        return false;
      }
    } catch (configError) {
      console.error(colorizer.red('Configuration error:'), configError.message);
      showWarning('Your API configuration appears to be invalid or missing required values');
      
      const setupNow = await confirm({
        message: 'Would you like to run the setup process now?'
      });
      
      if (setupNow) {
        await CLISetup();
        return false;
      } else {
        await CLIBuildMenu();
        return false;
      }
    }
  } catch (error) {
    // Log any unexpected errors outside of API calls
    console.error(colorizer.red('Unexpected error:'), error);
    handleError(error);
  }
}

/**
 * Show function details and menu
 * 
 * @param {string} functionId - Function ID
 */
const CLIFunctionDetailsMenu = async (functionId) => {
  try {
    console.log(separator);
    console.log(colorizer.bold('Function details:'));
    
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Get function details
    const functionDetails = await api.getFunction(functionId);
    
    console.log(functionDetails);
    console.log(separator);
    
    const answer = await select({
      message: 'Select action:',
      choices: [  
        {
          name: 'Create new function version',
          value: 'newVersion',
          description: 'Bundle and create a new function version or update env. variables.',
        },
        {
          name: 'Manage environment variables',
          value: 'manageEnvVars',
          description: 'View, add, update, or delete environment variables for this function.',
        },
        {
          name: 'Update function details',
          value: 'updateFunction',
          description: 'Update function name and description.',
        },
        {
          name: 'Manage existing function versions',
          value: 'functionVersions',
          description: 'Retrieve function versions.',
        },
        {
          name: 'Invoke function',
          value: 'functionInvoke',
          description: 'Manually invoke a function.'
        },
        {
          name: 'Fetch logs',
          value: 'functionLogs',
          description: 'Retrieve runtime logs for this function.',
        },
        {
          name: '(Back)',
          value: 'back'
        }
      ]
    });
    
    switch(answer) {
      case 'functionLogs': await CLIFunctionLogs(functionId); return false;
      case 'newVersion': await CLINewVersion(functionId); return false;
      case 'updateFunction': await CLIUpdateFunction(functionId, functionDetails); return false;
      case 'functionVersions': await CLIFunctionVersions(functionId, functionDetails.current_version); return false;
      case 'functionInvoke': await CLIFunctionInvoke(functionId, functionDetails.invocation_uri); return false;
      case 'manageEnvVars': await routeCommand('update-env-vars', { id: functionId, interactive: true }); return false;
      case 'back': await CLIBuildMenu(); return false;
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * Create a new function version
 * 
 * @param {string} functionId - Function ID
 */
const CLINewVersion = async (functionId) => {
  try {
    const fileSelect = await input({  
      name: 'fileSelect',
      message: 'Relative path to input file:',
      default: './function.js'
    });

    const compatibilityDate = await input({  
      name: 'compatibilityDate',
      message: 'Compatibility date (YYYY-MM-DD format):',
      default: 'latest'
    });

    const passEnvVariables = await confirm({
      message: 'Add custom environment variables?',
      default: false
    });

    let environmentVariables = false;
    if (passEnvVariables) {
      environmentVariables = await editor({
        message: 'Enter environment variables as JSON:',
        default: '{\n\n}',
        postfix: '.js'
      });

      try {
        // Validate JSON
        JSON.parse(environmentVariables);
        showInfo('Environment variables validated.');
      } catch(err) {
        showInfo('Invalid JSON format. Operation canceled.');
        await CLIFunctionDetailsMenu(functionId);
        return false;
      }
    }

    const confirmDetails = await confirm({ message: 'Proceed with above details?' });

    if (confirmDetails) {
      // Bundle the function
      showInfo('Bundling code...');
      execSync(`npm run build ${fileSelect}`);
      showInfo('File bundled.');

      // Get API configuration
      const apiConfig = await getApiConfig();
      
      // Create API client
      const api = new GliaApiClient(apiConfig);
      
      // Read bundled code
      const code = fs.readFileSync('./function-out.js', 'utf8');
      
      // Create version
      const options = {
        compatibilityDate: compatibilityDate === 'latest' ? false : compatibilityDate,
        environmentVariables: environmentVariables ? JSON.parse(environmentVariables) : false
      };
      
      const gfVersion = await api.createVersion(functionId, code, options);
      
      showSuccess('Function version creation tasked enqueued');
      console.log(gfVersion);
      
      await CLIFunctionDetailsMenu(functionId);
      return false;
    } else {
      showInfo('Canceled');
      await CLIFunctionDetailsMenu(functionId);
      return false;
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * List and manage function versions
 * 
 * @param {string} functionId - Function ID
 * @param {object} currentVersion - Current version details
 */
const CLIFunctionVersions = async (functionId, currentVersion) => {
  try {
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Get versions
    const versions = await api.listVersions(functionId);
    
    if (!versions.function_versions || versions.function_versions.length === 0) {
      showInfo('No function versions found');
      await CLIFunctionDetailsMenu(functionId);
      return false;
    }
    
    // Create choices from versions
    let choices = versions.function_versions.map(item => ({
      name: `${currentVersion && currentVersion.id === item.id ? '(current)' : ''} ${item.id} (created at ${item.created_at})`,
      value: item.id,
      description: item.id === currentVersion?.id ? 'Currently deployed version' : undefined
    }));

    // Add special quick access option for env vars of current version
    if (currentVersion) {
      choices.unshift({
        name: `Manage environment variables (current version)`,
        value: `env_vars_${currentVersion.id}`,
        description: `Quickly manage environment variables for the currently deployed version`
      });
    }

    choices.push({
      name: '(Back)',
      value: 'back',
    });

    const versionSelect = await select({
      message: 'Function versions:',
      choices
    });

    if (versionSelect === 'back') {
      await CLIFunctionDetailsMenu(functionId);
      return false;
    } else if (versionSelect.startsWith('env_vars_')) {
      // Extract version ID and route to env vars management
      const versionId = versionSelect.replace('env_vars_', '');
      await routeCommand('update-env-vars', { id: functionId, interactive: true });
      return false;
    }

    await CLIFunctionVersion(functionId, versionSelect);
    return false;
  } catch (error) {
    handleError(error);
  }
}

/**
 * Show function version details
 * 
 * @param {string} functionId - Function ID
 * @param {string} versionId - Version ID
 */
const CLIFunctionVersion = async (functionId, versionId) => {
  try {
    console.log(separator);
    console.log(colorizer.bold('Function version details:'));
    
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Get version details
    const version = await api.getVersion(functionId, versionId);
    
    console.log(version);
    console.log(separator);
    
    const answer = await select({
      message: 'Select action:',
      choices: [
        {
          name: 'Deploy function version',
          value: 'deployFunction',
          description: 'Mark this function version as main.',
        },
        {
          name: 'Update environment variables (CLI method)',
          value: 'updateEnvironment',
          description: 'Create a new version based on this one with updated environment variables',
        },
        {
          name: 'Manage environment variables (interactive)',
          value: 'manageEnvVars',
          description: 'Interactive UI for adding/updating/removing environment variables',
        },
        {
          name: '(Back)',
          value: 'back'
        }
      ]
    });
    
    switch(answer) {
      case 'deployFunction': await CLIDeployFunction(functionId, versionId); return false;
      case 'updateEnvironment': await CLIUpdateEnvironment(functionId, versionId, version); return false;
      case 'manageEnvVars': await routeCommand('update-env-vars', { id: functionId, interactive: true }); return false;
      case 'back': await CLIFunctionDetailsMenu(functionId); return false;
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * Deploy a function version
 * 
 * @param {string} functionId - Function ID
 * @param {string} versionId - Version ID
 */
const CLIDeployFunction = async (functionId, versionId) => {
  try {
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Deploy version
    const gfDeployment = await api.deployVersion(functionId, versionId);
    
    showSuccess('Function version deployed');
    showInfo('Writing audit logs');
    
    await CLIFunctionDetailsMenu(functionId);
    return false;
  } catch (error) {
    handleError(error);
  }
}

/**
 * Update environment variables for a function version
 * Uses the standardized updateEnvVars command for consistency
 * 
 * @param {string} functionId - Function ID
 * @param {string} versionId - Version ID to use as base
 * @param {Object} version - Version details
 */
const CLIUpdateEnvironment = async (functionId, versionId, version) => {
  try {
    console.log(separator);
    console.log(colorizer.bold('Update environment variables:'));
    
    // Show current environment variables if available
    const currentEnvVars = version.defined_environment_variables || [];
    
    if (currentEnvVars.length > 0) {
      console.log(colorizer.blue('Current environment variables:'));
      currentEnvVars.forEach(varName => {
        console.log(`- ${varName}`);
      });
      console.log('');
    } else {
      console.log(colorizer.blue('No environment variables currently defined.'));
      console.log('');
    }
    
    // Ask for environment variables as JSON
    const envString = await editor({
      message: 'Enter environment variables as JSON:',
      default: currentEnvVars.length > 0 
        ? '{\n  // Existing variables - values are not shown for security\n  // Update as needed or add new variables\n' + 
          currentEnvVars.map(varName => `  "${varName}": ""`).join(',\n') + 
          '\n}'
        : '{\n  "NEW_VARIABLE": "value",\n  "ANOTHER_VARIABLE": "another value"\n}',
      postfix: '.json'
    });
    
    let envVars;
    try {
      // Validate JSON
      envVars = parseAndValidateJson(envString);
      showInfo('Environment variables validated.');
    } catch (err) {
      showWarning(`Invalid JSON format: ${err.message}`);
      await CLIFunctionVersion(functionId, versionId);
      return false;
    }
    
    // Confirm update
    const confirmUpdate = await confirm({
      message: 'Create new version with these environment variables?',
      default: true
    });
    
    if (!confirmUpdate) {
      showInfo('Update cancelled');
      await CLIFunctionVersion(functionId, versionId);
      return false;
    }
    
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Create a new version based on the existing one with updated environment variables
    showInfo('Creating new version...');
    
    const options = {
      environmentVariables: envVars
    };
    
    // Use the updateVersion method which handles the PATCH endpoint
    const result = await api.updateVersion(functionId, versionId, options);
    
    showSuccess('Function version creation task started');
    console.log(result);
    
    // Offer to automatically deploy the new version once it's ready
    const autoDeploy = await confirm({
      message: 'Would you like to check and automatically deploy this version when it\'s ready?',
      default: true
    });
    
    if (autoDeploy) {
      // Poll the task endpoint until the version is ready
      showInfo('Waiting for version to be created...');
      
      let taskCompleted = false;
      let newVersionId = null;
      
      // Extract task ID from the response
      const taskPath = result.self;
      const taskId = taskPath.split('/').pop();
      
      // Poll every 2 seconds until task completes or fails
      while (!taskCompleted) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
        
        try {
          const taskResult = await api.getVersionCreationTask(functionId, taskId);
          
          if (taskResult.status === 'completed') {
            taskCompleted = true;
            newVersionId = taskResult.entity?.id;
            showSuccess('New version created successfully');
          } else if (taskResult.status === 'failed') {
            taskCompleted = true;
            showWarning('Version creation failed');
          } else {
            process.stdout.write('.');
          }
        } catch (error) {
          showWarning(`Error checking task status: ${error.message}`);
          break;
        }
      }
      
      // Deploy if we have a new version ID
      if (newVersionId) {
        const confirmDeploy = await confirm({
          message: `Deploy new version ${newVersionId} now?`,
          default: true
        });
        
        if (confirmDeploy) {
          try {
            await api.deployVersion(functionId, newVersionId);
            showSuccess('New version deployed successfully');
          } catch (error) {
            showWarning(`Error deploying new version: ${error.message}`);
          }
        }
      }
    }
    
    await CLIFunctionDetailsMenu(functionId);
    return false;
  } catch (error) {
    handleError(error);
  }
}

/**
 * View function logs
 * 
 * @param {string} functionId - Function ID
 */
const CLIFunctionLogs = async (functionId) => {
  try {
    console.log(separator);
    console.log(colorizer.bold('Function logs:'));
    
    // Fetch logs options
    const fetchAllLogs = await confirm({
      message: 'Fetch all logs (follows pagination)?',
      default: true
    });
    
    const limitPerPage = await input({
      message: 'Number of logs per page:',
      default: '1000'
    });
    
    const useTimeRange = await confirm({
      message: 'Filter logs by time range?',
      default: false
    });
    
    let startTime = null;
    let endTime = null;
    
    if (useTimeRange) {
      // Helper function to get a default time X hours ago in ISO format
      const getTimeAgo = (hoursAgo) => {
        const date = new Date();
        date.setHours(date.getHours() - hoursAgo);
        return date.toISOString();
      };
      
      startTime = await input({
        message: 'Start time (ISO-8601 format):',
        default: getTimeAgo(24) // Default to 24 hours ago
      });
      
      endTime = await input({
        message: 'End time (ISO-8601 format):',
        default: new Date().toISOString() // Default to now
      });
    }
    
    console.log(colorizer.blue('Fetching logs, please wait...'));
    
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Create a mock BaseCommand for progress reporting
    const mockCommand = {
      info: (message) => console.log(colorizer.blue(message))
    };
    
    // Options for the fetch logs command
    const options = {
      functionId,
      logsOptions: {
        limit: parseInt(limitPerPage, 10),
        startTime,
        endTime
      },
      fetchAll: fetchAllLogs,
      command: mockCommand
    };
    
    // Import the fetchLogs function from commands
    const { fetchLogs } = await import('../commands/fetchLogs.js');
    
    // Fetch logs with the requested options
    const logs = await fetchLogs(options);
    
    // Show logs count
    if (logs.logs && logs.logs.length > 0) {
      console.log(colorizer.green(`Found ${logs.logs.length} log entries`));
      
      // Display logs as a table with timestamps and messages
      console.log(separator);
      console.log(colorizer.bold('Latest logs:'));
      
      // Sort logs by timestamp (most recent first)
      const sortedLogs = [...logs.logs].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      // Display up to 50 most recent logs
      const displayLimit = 50;
      const logsToShow = sortedLogs.slice(0, displayLimit);
      
      logsToShow.forEach(log => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        console.log(`[${timestamp}] ${log.message}`);
      });
      
      if (sortedLogs.length > displayLimit) {
        console.log(colorizer.blue(`\nShowing ${displayLimit} most recent logs out of ${sortedLogs.length} total`));
      }
      
      // Offer to save logs to file
      const saveToFile = await confirm({
        message: 'Save logs to file?',
        default: true
      });
      
      if (saveToFile) {
        const filePath = await input({
          message: 'File path:',
          default: './function-logs.json'
        });
        
        await fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
        console.log(colorizer.green(`Logs saved to ${filePath}`));
      }
    } else {
      console.log(colorizer.yellow('No logs found for this function'));
    }
    
    await CLIFunctionDetailsMenu(functionId);
    return false;
  } catch (error) {
    handleError(error);
  }
}

/**
 * Invoke a function
 * 
 * @param {string} functionId - Function ID
 * @param {string} invocationUri - Function invocation URI
 */
const CLIFunctionInvoke = async (functionId, invocationUri) => {
  try {
    const passPayload = await confirm({
      message: 'Add custom payload?'
    });

    let payload;
    if (passPayload) {
      payload = await editor({
        message: 'Enter payload:',
      });

      try {
        // Validate JSON
        JSON.parse(payload);
        showInfo('Payload validated.');
      } catch(err) {
        showInfo('Invalid JSON format. Operation canceled.');
        await CLIFunctionDetailsMenu(functionId);
        return false;
      }
    }

    showInfo('Invoking function...');
    
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Invoke function
    const response = await api.invokeFunction(invocationUri, payload);
    
    console.log(separator);
    console.log(colorizer.bold('Function response:'));
    console.log(response);
    
    await CLIFunctionDetailsMenu(functionId);
    return false;
  } catch (error) {
    handleError(error);
  }
}

/**
 * Run the CLI
 */
export async function runCLI() {
  try {
    CLIIntro();
    
    // Reset environment variables to ensure clean state
    const GLIA_ENV_VARS = [
      'GLIA_BEARER_TOKEN', 'GLIA_TOKEN_EXPIRES_AT', 'GLIA_SITE_ID', 
      'GLIA_KEY_ID', 'GLIA_KEY_SECRET', 'GLIA_API_URL'
    ];
    
    // Save current CLI arguments
    const cliArgs = {};
    GLIA_ENV_VARS.forEach(key => {
      if (process.env[key]) {
        cliArgs[key] = process.env[key];
      }
    });
    
    // Load full configuration first to ensure site ID is properly loaded
    // This is a critical step to fix the site persistence issue
    const config = await loadConfig();
    console.log(colorizer.dim(`[DEBUG] Initial config loaded: GLIA_SITE_ID=${config.siteId}, profile=${config.profile}`));
    
    // If there's no site ID after loading, show a warning
    if (!config.siteId) {
      console.log(colorizer.yellow('\n⚠️ Warning: No site ID found in configuration. Some commands may not work properly.'));
      console.log(colorizer.yellow('Use "Change active site" from the main menu to set a site ID.\n'));
    } else {
      // Verify site ID is set in the environment
      if (!process.env.GLIA_SITE_ID) {
        console.log(colorizer.yellow(`\n⚠️ Warning: Site ID from config not applied to environment!\n`));
      }
    }
    
    // Check if we have valid API configuration and attempt to refresh if expired
    const hasToken = await hasValidBearerToken(true);
    
    // Always show main menu first for better UX - this gives users the choice to
    // authenticate, manage profiles, or access functions from the highest level menu
    await CLIMainMenu();
    
    // If execution reaches here (after all menus have returned), 
    // it means we should exit the program gracefully
    process.exit(0);
  } catch (error) {
    handleError(error);
    // Exit with error code after handling error
    process.exit(1);
  }
}

/**
 * Main entry point when run directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI();
}

/**
 * Change the current site within the active profile
 */
const CLIChangeSite = async () => {
  try {
    // Get current profile and site info
    const currentProfile = process.env.GLIA_PROFILE || 'default';
    const currentSiteId = process.env.GLIA_SITE_ID;
    
    console.log(colorizer.blue('Current active profile:'), colorizer.bold(currentProfile));
    console.log(colorizer.blue('Current active site ID:'), colorizer.bold(currentSiteId || 'none'));
    console.log(separator);
    
    // Get API configuration to access token
    let config;
    try {
      config = await getApiConfig();
    } catch (configError) {
      showWarning('Could not load configuration. You may need to run setup first.');
      await CLIMainMenu();
      return false;
    }
    
    if (!config.bearerToken) {
      // Try to generate token if we have credentials
      if (config.keyId && config.keySecret) {
        try {
          const tokenInfo = await createBearerToken(
            config.keyId,
            config.keySecret,
            config.apiUrl || 'https://api.glia.com'
          );
          
          config.bearerToken = tokenInfo.token;
          
          // Update token in current profile
          const updates = {
            'GLIA_BEARER_TOKEN': tokenInfo.token,
            'GLIA_TOKEN_EXPIRES_AT': tokenInfo.expiresAt
          };
          
          if (currentProfile === 'default') {
            await updateGlobalConfig(updates);
          } else {
            await updateProfile(currentProfile, updates);
          }
          
          // Update process.env
          process.env.GLIA_BEARER_TOKEN = tokenInfo.token;
          process.env.GLIA_TOKEN_EXPIRES_AT = tokenInfo.expiresAt;
        } catch (tokenError) {
          showWarning(`Could not generate token: ${tokenError.message}`);
          await CLIMainMenu();
          return false;
        }
      } else {
        showWarning('No API credentials available. Please run setup first.');
        await CLIMainMenu();
        return false;
      }
    }
    
    // Fetch the list of sites this token has access to
    console.log(colorizer.blue('Fetching available sites...'));
    try {
      const sitesResponse = await fetch(`${config.apiUrl}/sites`, {
        headers: {
          'Authorization': `Bearer ${config.bearerToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.salemove.v1+json'
        }
      });
      
      if (!sitesResponse.ok) {
        throw new Error(`${sitesResponse.status} ${sitesResponse.statusText}`);
      }
      
      const sitesData = await sitesResponse.json();
      
      if (!sitesData.sites || sitesData.sites.length === 0) {
        showWarning('Your API key does not have access to any sites.');
        await CLIMainMenu();
        return false;
      }
      
      // Create choices for site selection
      const siteChoices = sitesData.sites.map(site => ({
        name: `${site.name || '[Unnamed site]'} (${site.id})${site.id === currentSiteId ? ' (current)' : ''}`,
        value: site.id,
        disabled: site.id === currentSiteId
      }));
      
      siteChoices.push({
        name: '(Cancel)',
        value: 'cancel'
      });
      
      // Let user select a site
      const selectedSiteId = await select({
        message: 'Select site to use:',
        choices: siteChoices
      });
      
      if (selectedSiteId === 'cancel') {
        await CLIMainMenu();
        return false;
      }
      
      // Update site ID in config and profile
      const selectedSite = sitesData.sites.find(site => site.id === selectedSiteId);
      const siteName = selectedSite.name || selectedSiteId;
      
      // Clear any existing site ID from process.env to prevent it from overriding
      delete process.env.GLIA_SITE_ID;
      
      // Update profile with new site ID
      if (currentProfile === 'default') {
        await updateGlobalConfig({
          'GLIA_SITE_ID': selectedSiteId
        });
      } else {
        await updateProfile(currentProfile, {
          'GLIA_SITE_ID': selectedSiteId
        });
      }
      
      // Important: Use a direct file write to local .env to avoid conflicts
      // This ensures the local .env won't override the profile setting
      if (fs.existsSync(LOCAL_CONFIG_FILE)) {
        console.log(colorizer.dim(`[DEBUG] Updating local .env file with new site ID`));
        await updateEnvFile({
          'GLIA_SITE_ID': selectedSiteId
        });
      }
      
      // Update current process.env AFTER updating all config files
      process.env.GLIA_SITE_ID = selectedSiteId;
      
      // Force reload of configuration with new site ID
      await loadConfig();
      
      // Verify the site ID was set properly
      const verifyConfig = await loadConfig();
      console.log(colorizer.dim(`[DEBUG] Site change verification - new site ID: ${verifyConfig.siteId}`));
      
      // Double check that process.env has the correct site ID
      if (process.env.GLIA_SITE_ID !== selectedSiteId) {
        console.log(colorizer.yellow(`[WARNING] Site ID mismatch after update! Expected: ${selectedSiteId}, Got: ${process.env.GLIA_SITE_ID || 'none'}`));
        process.env.GLIA_SITE_ID = selectedSiteId; // Force it to be correct
      }
      
      showSuccess(`Switched to site: ${siteName} (${selectedSiteId})`);
      showInfo('The new site will be used for all subsequent operations.');
      showInfo('You are still using the same profile and API credentials.');
      
      await CLIMainMenu();
      return false;
    } catch (error) {
      showError(`Failed to fetch available sites: ${error.message}`);
      await CLIMainMenu();
      return false;
    }
  } catch (error) {
    handleError(error);
    await CLIMainMenu();
    return false;
  }
};

/**
 * Profile management menu for the CLI
 */
const CLIProfileMenu = async () => {
  try {
    // Get current profile
    const currentProfile = process.env.GLIA_PROFILE || 'default';
    
    // Get all profiles
    const profiles = listProfiles();
    
    // Make sure default is included
    if (!profiles.includes('default')) {
      profiles.unshift('default');
    }
    
    console.log(colorizer.blue('Current active profile:'), colorizer.bold(currentProfile));
    console.log(separator);
    
    const answer = await select({
      message: 'Select action:',
      choices: [
        {
          name: 'List profiles',
          value: 'list',
          description: 'Show all available profiles',
        },
        {
          name: 'Create new profile',
          value: 'create',
          description: 'Create a new configuration profile',
        },
        {
          name: 'Switch profile',
          value: 'switch',
          description: 'Switch to a different profile',
        },
        {
          name: 'Delete profile',
          value: 'delete',
          description: 'Delete an existing profile',
        },
        {
          name: '(Back)',
          value: 'back'
        }
      ]
    });
    
    switch(answer) {
      case 'list': await CLIListProfiles(); return false;
      case 'create': await CLICreateProfile(); return false;
      case 'switch': await CLISwitchProfile(); return false;
      case 'delete': await CLIDeleteProfile(); return false;
      case 'back': await CLIMainMenu(); return false;
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * List all available profiles
 */
const CLIListProfiles = async () => {
  try {
    // Get current profile
    const currentProfile = process.env.GLIA_PROFILE || 'default';
    
    // Get all profiles
    const profiles = listProfiles();
    
    // Make sure default is included
    if (!profiles.includes('default')) {
      profiles.unshift('default');
    }
    
    console.log(colorizer.blue('Available profiles:'));
    
    profiles.forEach(profile => {
      if (profile === currentProfile) {
        console.log(`  ${colorizer.green('*')} ${profile} ${colorizer.green('(current)')}`);
      } else {
        console.log(`  ${profile}`);
      }
    });
    
    console.log(''); // Empty line
    await CLIProfileMenu();
    return false;
  } catch (error) {
    handleError(error);
  }
}

/**
 * Create a new profile
 */
const CLICreateProfile = async () => {
  try {
    const profileName = await input({
      message: 'Enter new profile name:',
      validate: (input) => {
        if (!input) return 'Profile name is required';
        if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
          return 'Profile name can only contain letters, numbers, dashes, and underscores';
        }
        return true;
      }
    });
    
    // Create the profile
    await createProfile(profileName);
    
    showSuccess(`Profile '${profileName}' created successfully`);
    
    // Ask if they want to switch to this profile
    const switchToNew = await confirm({
      message: `Switch to the new '${profileName}' profile now?`,
      default: true
    });
    
    if (switchToNew) {
      await switchProfile(profileName);
      showSuccess(`Switched to profile '${profileName}'`);
    }
    
    await CLIProfileMenu();
    return false;
  } catch (error) {
    handleError(error);
    await CLIProfileMenu();
    return false;
  }
}

/**
 * Switch to a different profile
 */
const CLISwitchProfile = async () => {
  try {
    // Get current profile
    const currentProfile = process.env.GLIA_PROFILE || 'default';
    
    // Get all profiles
    const profiles = listProfiles();
    
    // Make sure default is included
    if (!profiles.includes('default')) {
      profiles.unshift('default');
    }
    
    // Create choices with current profile marked
    const choices = profiles.map(profile => ({
      name: profile === currentProfile ? `${profile} (current)` : profile,
      value: profile,
      disabled: profile === currentProfile
    }));
    
    const profileName = await select({
      message: 'Select profile to switch to:',
      choices
    });
    
    // Switch to the profile
    await switchProfile(profileName);
    
    // Create a token if we have credentials but no token
    const config = await loadConfig();
    
    // Debug info after profile switch
    console.log(colorizer.blue('Profile switch debug info:'));
    console.log(colorizer.blue('- Profile:'), profileName);
    console.log(colorizer.blue('- API URL:'), config.apiUrl);
    console.log(colorizer.blue('- Site ID:'), config.siteId);
    console.log(colorizer.blue('- Has API Key ID:'), !!config.keyId);
    console.log(colorizer.blue('- Has API Key Secret:'), !!config.keySecret);
    console.log(colorizer.blue('- Has Bearer Token:'), !!config.bearerToken);
    console.log(colorizer.blue('- Token expires:'), config.tokenExpiresAt ? new Date(config.tokenExpiresAt).toLocaleString() : 'n/a');
    
    if (config.keyId && config.keySecret) {
      try {
        // If no token or token is expired, create a new one
        if (!config.bearerToken || !config.tokenExpiresAt || 
            Date.now() >= (config.tokenExpiresAt - (5 * 60 * 1000))) {
          
          // Create a token using existing credentials
          console.log(colorizer.blue('Generating new token with credentials from profile...'));
          const tokenInfo = await createBearerToken(
            config.keyId,
            config.keySecret,
            config.apiUrl || 'https://api.glia.com',
            config.siteId
          );
          
          // Check if we need to update site ID
          let siteIdUpdated = false;
          if (tokenInfo.availableSites && tokenInfo.availableSites.length > 0) {
            if (tokenInfo.suggestedSiteId) {
              // A single site is available - offer to use it automatically
              const useSuggestedSite = await confirm({
                message: `Update profile to use site ID "${tokenInfo.suggestedSiteId}"?`,
                default: true
              });
              
              if (useSuggestedSite) {
                config.siteId = tokenInfo.suggestedSiteId;
                siteIdUpdated = true;
                showInfo(`Site ID updated to "${tokenInfo.suggestedSiteId}"`);
              }
            } else if (tokenInfo.availableSites.length > 1) {
              // Multiple sites available - ask user to choose
              const siteChoices = tokenInfo.availableSites.map(site => ({
                name: `${site.name || site.id}`,
                value: site.id
              }));
              
              siteChoices.push({
                name: '(Cancel - keep current site ID)',
                value: null
              });
              
              showInfo('Select a site ID that your API key has access to:');
              const chosenSiteId = await select({
                message: 'Choose site ID:',
                choices: siteChoices
              });
              
              if (chosenSiteId) {
                config.siteId = chosenSiteId;
                siteIdUpdated = true;
                showInfo(`Site ID updated to "${chosenSiteId}"`);
              }
            }
          }
          
          // Prepare updates for the profile
          const updates = {
            'GLIA_BEARER_TOKEN': tokenInfo.token,
            'GLIA_TOKEN_EXPIRES_AT': tokenInfo.expiresAt
          };
          
          // Also update site ID if it was changed
          if (siteIdUpdated) {
            updates['GLIA_SITE_ID'] = config.siteId;
            // Update process.env with the new site ID
            process.env.GLIA_SITE_ID = config.siteId;
          }
          
          // Update token in profile
          if (profileName === 'default') {
            await updateGlobalConfig(updates);
          } else {
            await updateProfile(profileName, updates);
          }
          
          // Update process.env with the new token
          process.env.GLIA_BEARER_TOKEN = tokenInfo.token;
          process.env.GLIA_TOKEN_EXPIRES_AT = tokenInfo.expiresAt;
          
          showInfo(`Bearer token generated for profile '${profileName}'`);
        }
      } catch (tokenError) {
        // Non-fatal error, just log it
        showWarning(`Note: Could not generate token: ${tokenError.message}`);
      }
    } else {
      showWarning(`Profile '${profileName}' does not have API credentials. You may need to run setup to add them.`);
    }
    
    showSuccess(`Switched to profile '${profileName}'`);
    
    // Delay slightly to make sure the user sees the success message
    await new Promise(resolve => setTimeout(resolve, 200));
    
    await CLIProfileMenu();
    return false;
  } catch (error) {
    handleError(error);
    await CLIProfileMenu();
    return false;
  }
}

/**
 * Delete a profile
 */
const CLIDeleteProfile = async () => {
  try {
    // Get current profile
    const currentProfile = process.env.GLIA_PROFILE || 'default';
    
    // Get all profiles
    const profiles = listProfiles();
    
    // Filter out default and current profile
    const availableProfiles = profiles.filter(profile => 
      profile !== 'default' && profile !== currentProfile
    );
    
    if (availableProfiles.length === 0) {
      showWarning('No profiles available to delete. You cannot delete the default profile or the currently active profile.');
      await CLIProfileMenu();
      return false;
    }
    
    const profileName = await select({
      message: 'Select profile to delete:',
      choices: [
        ...availableProfiles.map(profile => ({
          name: profile,
          value: profile,
        })),
        {
          name: '(Cancel)',
          value: 'cancel'
        }
      ]
    });
    
    if (profileName === 'cancel') {
      await CLIProfileMenu();
      return false;
    }
    
    // Confirm deletion
    const confirmDelete = await confirm({
      message: `Are you sure you want to delete profile '${profileName}'? This action cannot be undone.`,
      default: false
    });
    
    if (!confirmDelete) {
      showInfo('Profile deletion cancelled');
      await CLIProfileMenu();
      return false;
    }
    
    // Delete the profile
    await deleteProfile(profileName);
    
    showSuccess(`Profile '${profileName}' deleted successfully`);
    
    await CLIProfileMenu();
    return false;
  } catch (error) {
    handleError(error);
    await CLIProfileMenu();
    return false;
  }
}

/**
 * Run a function locally in development mode
 */
const CLIDevFunction = async () => {
  try {
    const functionPath = await input({  
      message: 'Path to function file:',
      default: './function.js'
    });
    
    const port = await input({
      message: 'Port to run server on:',
      default: '8787'
    });
    
    const watchMode = await confirm({
      message: 'Enable watch mode (auto-reload on file changes)?',
      default: true
    });
    
    const useEnv = await confirm({
      message: 'Add custom environment variables?',
      default: false
    });
    
    let env = {};
    if (useEnv) {
      const envString = await editor({
        message: 'Enter environment variables as JSON:',
        default: '{\n  "KEY": "value"\n}',
        postfix: '.json'
      });
      
      try {
        env = JSON.parse(envString);
        showSuccess('Environment variables validated');
      } catch (error) {
        showWarning(`Invalid JSON format: ${error.message}`);
        showInfo('Continuing with empty environment variables');
      }
    }

    showInfo('Starting local development server...');
    
    const { dev } = await import('../commands/dev.js');
    
    try {
      await dev({
        path: functionPath,
        port: parseInt(port, 10) || 8787,
        watch: watchMode,
        env: env
      });
      
      // Show additional info
      showSuccess('Development server is running');
      showInfo('Press Ctrl+C to stop the server and return to the menu');
      
      // Wait for user to terminate with Ctrl+C
      await new Promise(resolve => {
        process.on('SIGINT', () => {
          resolve();
        });
      });
      
      // Return to build menu
      await CLIBuildMenu();
      return false;
    } catch (error) {
      showError(`Failed to start development server: ${error.message}`);
      await CLIBuildMenu();
      return false;
    }
  } catch (error) {
    handleError(error);
  }
};

/**
 * Update function details (name and description)
 * 
 * @param {string} functionId - Function ID
 * @param {object} functionDetails - Current function details
 */
const CLIUpdateFunction = async (functionId, functionDetails) => {
  try {
    console.log(separator);
    console.log(colorizer.bold('Update function details:'));
    
    // Get current function name and description
    const currentName = functionDetails.name || '';
    const currentDescription = functionDetails.description || '';
    
    console.log(colorizer.blue('Current name:'), currentName);
    console.log(colorizer.blue('Current description:'), currentDescription);
    console.log('');
    
    // Ask for new name (default to current)
    const newName = await input({
      message: 'New function name:',
      default: currentName
    });
    
    // Ask for new description (default to current)
    const newDescription = await input({
      message: 'New function description:',
      default: currentDescription
    });
    
    // Check if anything changed
    if (newName === currentName && newDescription === currentDescription) {
      showInfo('No changes detected. Update cancelled.');
      await CLIFunctionDetailsMenu(functionId);
      return false;
    }
    
    // Confirm update
    const confirmUpdate = await confirm({
      message: 'Update function details with these values?',
      default: true
    });
    
    if (!confirmUpdate) {
      showInfo('Update cancelled.');
      await CLIFunctionDetailsMenu(functionId);
      return false;
    }
    
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Prepare updates object
    const updates = {};
    if (newName !== currentName) updates.name = newName;
    if (newDescription !== currentDescription) updates.description = newDescription;
    
    // Update function
    showInfo(`Updating function "${functionId}"...`);
    const updatedFunction = await api.updateFunction(functionId, updates);
    
    showSuccess('Function details updated successfully');
    
    // Show what was updated
    if (newName !== currentName) {
      console.log(colorizer.blue('New name:'), updatedFunction.name);
    }
    if (newDescription !== currentDescription) {
      console.log(colorizer.blue('New description:'), updatedFunction.description);
    }
    
    // Return to function details menu
    await CLIFunctionDetailsMenu(functionId);
    return false;
  } catch (error) {
    handleError(error);
  }
};

/**
 * Environment variables management menu
 */
const CLIManageEnvVars = async () => {
  try {
    console.log(separator);
    console.log(colorizer.bold('Environment Variables Management'));
    
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // First get functions list
    console.log(colorizer.blue('Fetching functions list...'));
    const list = await api.listFunctions();
    
    if (!list?.functions || list.functions.length === 0) {
      showInfo('No functions found');
      await CLIBuildMenu();
      return false;
    }
    
    // Create choices from functions
    const choices = list.functions.map(item => ({
      name: item.name,
      value: item.id,
    }));
    
    choices.push({
      name: '(Back)',
      value: 'back',
    });
    
    // Select function
    const functionId = await select({
      message: 'Select function to manage environment variables:',
      choices
    });
    
    if (functionId === 'back') {
      await CLIBuildMenu();
      return false;
    }
    
    // Get function details
    const functionDetails = await api.getFunction(functionId);
    
    // Check if function has a current version
    if (!functionDetails.current_version || !functionDetails.current_version.id) {
      showWarning(`Function ${functionDetails.name} has no current version deployed.`);
      const continueAnyway = await confirm({
        message: 'Would you like to create a new version with environment variables?',
        default: false
      });
      
      if (!continueAnyway) {
        await CLIBuildMenu();
        return false;
      }
      
      // If continuing, redirect to create new version with env vars
      await CLINewVersion(functionId);
      return false;
    }
    
    // Directly use update-env-vars command in interactive mode
    const result = await routeCommand('update-env-vars', { 
      id: functionId, 
      interactive: true 
    }, false);
    
    // After completing environment variable management, return to build menu
    await CLIBuildMenu();
    return false;
  } catch (error) {
    handleError(error);
    await CLIBuildMenu();
    return false;
  }
};

/**
 * Deploy project function
 */
const CLIDeployProject = async () => {
  try {
    console.log(separator);
    console.log(colorizer.bold('Deploy Project'));
    
    // Prompt for the manifest path
    const manifestPath = await input({
      message: 'Path to project manifest file:',
      default: 'glia-project.json'
    });
    
    // Confirm file exists
    try {
      await fs.access(manifestPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        showError(`Project manifest file not found: ${manifestPath}`);
        showInfo(`Create a ${colorizer.bold('glia-project.json')} file in your project directory.`);
        
        const showExample = await confirm({
          message: 'Would you like to see an example project manifest structure?',
          default: true
        });
        
        if (showExample) {
          // Show example structure from README-project-deploy.md or provide inline example
          console.log(colorizer.blue('\nExample project manifest structure:'));
          console.log(`{
  "name": "customer-support-project",
  "version": "1.0.0",
  "description": "A project with multiple components",
  "components": {
    "functions": [
      {
        "name": "api-handler",
        "description": "API handler function",
        "path": "functions/api-handler.js",
        "environment": {
          "API_KEY": "your-api-key"
        },
        "kvStore": {
          "namespaces": ["user_data"]
        }
      }
    ],
    "applets": [
      {
        "name": "user-widget",
        "description": "User interface widget",
        "path": "applets/user-widget.html",
        "scope": "engagement"
      }
    ]
  },
  "kvStore": {
    "namespaces": [
      {
        "name": "user_data",
        "description": "User data storage for tracking sessions",
        "ttl": 86400
      }
    ]
  },
  "linkages": [
    {
      "from": "functions.api-handler",
      "to": "applets.user-widget",
      "placeholders": {
        "API_URI": "invocation_uri"
      }
    }
  ]
}`);
        }
        
        await CLIBuildMenu();
        return false;
      }
      throw error;
    }
    
    // Ask for deployment options
    const dryRun = await confirm({
      message: 'Run in dry-run mode (validate only, no deployment)?',
      default: false
    });
    
    // Only ask for more options if not in dry run mode
    let skipFunctions = false;
    let skipApplets = false;
    let noRollback = false;
    
    if (!dryRun) {
      skipFunctions = await confirm({
        message: 'Skip function deployment?',
        default: false
      });
      
      skipApplets = await confirm({
        message: 'Skip applet deployment?',
        default: false
      });
      
      noRollback = await confirm({
        message: 'Disable rollback on failure?',
        default: false
      });
    }
    
    // Confirm deployment
    const confirmDeployment = await confirm({
      message: dryRun ? 
        'Proceed with validation?' : 
        'Proceed with project deployment?',
      default: true
    });
    
    if (!confirmDeployment) {
      showInfo('Deployment cancelled');
      await CLIBuildMenu();
      return false;
    }
    
    // Prepare options for command
    const options = {
      manifest: manifestPath,
      dryRun,
      skipFunctions,
      skipApplets,
      rollbackOnFailure: !noRollback,
      command: {
        info: (message) => console.log(colorizer.blue(message)),
        success: (message) => console.log(colorizer.green(message)),
        warning: (message) => console.log(colorizer.yellow(message)),
        error: (message) => console.log(colorizer.red(message))
      },
      // Add a callback function to fix the "cb must be a function" error
      cb: (error, result) => {
        if (error) {
          console.error(colorizer.red(`Error: ${error.message}`));
          return false;
        }
        return result;
      }
    };
    
    // Execute the command
    showInfo(dryRun ? 'Validating project...' : 'Deploying project...');
    const result = await routeCommand('deploy-project', options);
    
    if (!result.success) {
      showError(`Project ${dryRun ? 'validation' : 'deployment'} failed: ${result.error}`);
    } else if (dryRun) {
      showSuccess('Project validation successful!');
    } else {
      showSuccess('Project deployment completed successfully!');
      
      // Show deployment summary
      console.log(colorizer.blue('\nDeployment summary:'));
      if (result.deploymentState) {
        console.log(`- Functions: ${result.deploymentState.functions || 0}`);
        console.log(`- Function versions: ${result.deploymentState.functionVersions || 0}`);
        console.log(`- Function deployments: ${result.deploymentState.functionDeployments || 0}`);
        console.log(`- Applets: ${result.deploymentState.applets || 0}`);
        console.log(`- KV pairs: ${result.deploymentState.kvPairs || 0}`);
      }
    }
    
    await CLIBuildMenu();
    return false;
  } catch (error) {
    handleError(error);
    await CLIBuildMenu();
    return false;
  }
};

/**
 * KV Store management menu
 */
const CLIManageKvStore = async () => {
  try {
    console.log(separator);
    console.log(colorizer.bold('KV Store Management'));
    
    // Check if we have a valid token and site ID first
    if (!process.env.GLIA_BEARER_TOKEN || !process.env.GLIA_SITE_ID) {
      showWarning('You need to be authenticated with a valid site ID to use KV Store.');
      const setupNow = await confirm({
        message: 'Would you like to run setup now?'
      });
      
      if (setupNow) {
        await CLISetup();
      } else {
        await CLIBuildMenu();
      }
      return false;
    }
    
    // Ask for namespace first
    const namespace = await input({
      message: 'Enter KV store namespace:',
      validate: (input) => {
        if (!input) return 'Namespace is required';
        if (Buffer.from(input).length > 128) {
          return 'Namespace exceeds maximum length of 128 bytes';
        }
        return true;
      }
    });
    
    // KV Store operation menu
    const answer = await select({
      message: 'Select operation:',
      choices: [
        {
          name: 'List values in namespace',
          value: 'list',
          description: 'List all key-value pairs in the namespace',
        },
        {
          name: 'Get a value',
          value: 'get',
          description: 'Get a specific value by key',
        },
        {
          name: 'Set a value',
          value: 'set',
          description: 'Set a value for a specific key',
        },
        {
          name: 'Delete a value',
          value: 'delete',
          description: 'Delete a specific key-value pair',
        },
        {
          name: 'Conditional update (test-and-set)',
          value: 'test-and-set',
          description: 'Update a value only if it matches expected current value',
        },
        {
          name: '(Back)',
          value: 'back'
        }
      ]
    });
    
    // Process the selected operation
    switch(answer) {
      case 'list':
        await routeCommand('kv:list', { namespace, all: true, json: false });
        break;
      case 'get':
        const getKey = await input({
          message: 'Enter key to get:',
          validate: (input) => {
            if (!input) return 'Key is required';
            if (Buffer.from(input).length > 512) {
              return 'Key exceeds maximum length of 512 bytes';
            }
            return true;
          }
        });
        await routeCommand('kv:get', { namespace, key: getKey });
        break;
      case 'set':
        const setKey = await input({
          message: 'Enter key to set:',
          validate: (input) => {
            if (!input) return 'Key is required';
            if (Buffer.from(input).length > 512) {
              return 'Key exceeds maximum length of 512 bytes';
            }
            return true;
          }
        });
        
        const valueType = await select({
          message: 'Select value type:',
          choices: [
            { name: 'String', value: 'string' },
            { name: 'Boolean (true)', value: 'true' },
            { name: 'Boolean (false)', value: 'false' },
            { name: 'Null', value: 'null' }
          ]
        });
        
        let setValue;
        if (valueType === 'string') {
          setValue = await input({
            message: 'Enter string value:',
            validate: (input) => {
              if (input === undefined) return 'Value is required';
              if (Buffer.from(input).length > 16000) {
                return 'Value exceeds maximum size of 16,000 bytes';
              }
              return true;
            }
          });
        } else {
          setValue = valueType; // 'true', 'false', or 'null'
        }
        
        await routeCommand('kv:set', { namespace, key: setKey, value: setValue });
        break;
      case 'delete':
        const deleteKey = await input({
          message: 'Enter key to delete:',
          validate: (input) => {
            if (!input) return 'Key is required';
            return true;
          }
        });
        await routeCommand('kv:delete', { namespace, key: deleteKey });
        break;
      case 'test-and-set':
        const testKey = await input({
          message: 'Enter key to update:',
          validate: (input) => {
            if (!input) return 'Key is required';
            if (Buffer.from(input).length > 512) {
              return 'Key exceeds maximum length of 512 bytes';
            }
            return true;
          }
        });
        
        const oldValueType = await select({
          message: 'Select current value type:',
          choices: [
            { name: 'String', value: 'string' },
            { name: 'Boolean (true)', value: 'true' },
            { name: 'Boolean (false)', value: 'false' },
            { name: 'Null', value: 'null' }
          ]
        });
        
        let oldValue;
        if (oldValueType === 'string') {
          oldValue = await input({
            message: 'Enter current string value:',
            validate: (input) => {
              if (input === undefined) return 'Value is required';
              return true;
            }
          });
        } else {
          oldValue = oldValueType;
        }
        
        const newValueType = await select({
          message: 'Select new value type:',
          choices: [
            { name: 'String', value: 'string' },
            { name: 'Boolean (true)', value: 'true' },
            { name: 'Boolean (false)', value: 'false' },
            { name: 'Null', value: 'null' }
          ]
        });
        
        let newValue;
        if (newValueType === 'string') {
          newValue = await input({
            message: 'Enter new string value:',
            validate: (input) => {
              if (input === undefined) return 'Value is required';
              if (Buffer.from(input).length > 16000) {
                return 'Value exceeds maximum size of 16,000 bytes';
              }
              return true;
            }
          });
        } else {
          newValue = newValueType;
        }
        
        await routeCommand('kv:test-and-set', { 
          namespace, 
          key: testKey, 
          oldValue, 
          newValue 
        });
        break;
      case 'back':
        await CLIBuildMenu(); 
        return false;
    }
    
    // After the operation is complete, ask if user wants to do another operation
    const continueOperations = await confirm({
      message: 'Would you like to perform another KV Store operation?',
      default: true
    });
    
    if (continueOperations) {
      await CLIManageKvStore();
    } else {
      await CLIBuildMenu();
    }
    return false;
  } catch (error) {
    handleError(error);
    await CLIBuildMenu();
    return false;
  }
};

/**
 * Applet management menu
 */
const CLIManageApplets = async () => {
  try {
    console.log(separator);
    console.log(colorizer.bold('Applet Management'));
    
    const answer = await select({
      message: 'Select action:',
      choices: [
        {
          name: 'Create new applet from template',
          value: 'create',
          description: 'Create a new applet using HTML or React templates',
        },
        {
          name: 'List available templates',
          value: 'list-templates',
          description: 'Show all available applet templates',
        },
        {
          name: 'Deploy an applet',
          value: 'deploy',
          description: 'Upload and deploy an existing applet HTML file',
        },
        {
          name: 'List and manage applets',
          value: 'select',
          description: 'List, view, and manage your site\'s applets',
        },
        {
          name: 'Update an applet',
          value: 'update',
          description: 'Update an existing applet',
        },
        {
          name: '(Back)',
          value: 'back'
        }
      ]
    });
    
    switch(answer) {
      case 'create':
        await routeCommand('create-applet', { interactive: true });
        break;
      case 'list-templates':
        await routeCommand('list-applet-templates', {});
        break;
      case 'deploy':
        await routeCommand('deploy-applet', { interactive: true });
        break;
      case 'select':
        await routeCommand('select-applet', { interactive: true });
        break;
      case 'update':
        await routeCommand('update-applet', { interactive: true });
        break;
      case 'back':
        await CLIBuildMenu();
        return false;
    }
    
    // Return to applet management menu after operation completes
    const continueOperations = await confirm({
      message: 'Would you like to perform another applet operation?',
      default: true
    });
    
    if (continueOperations) {
      await CLIManageApplets();
    } else {
      await CLIBuildMenu();
    }
    return false;
  } catch (error) {
    handleError(error);
    await CLIBuildMenu();
    return false;
  }
};

export { createBearerToken };
