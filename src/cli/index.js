/**
 * Main CLI entry point for Glia Functions CLI
 * 
 * Provides a modern, consistent interface for interacting with Glia Functions
 */

import chalk from 'chalk';
import { input, select, confirm, editor } from '@inquirer/prompts';
import * as fs from 'fs';
import { execSync } from 'child_process';

import { getCliVersion } from '../lib/config.js';
import GliaApiClient from '../lib/api.js';
import { loadConfig, updateEnvFile, updateGlobalConfig, getAuthConfig, getApiConfig, hasValidBearerToken, validateToken } from '../lib/config.js';
import { handleError, showSuccess, showInfo, showWarning } from './error-handler.js';
import { parseAndValidateJson } from '../lib/validation.js';
import { AuthenticationError, ConfigurationError, NetworkError } from '../lib/errors.js';
import { routeCommand } from './command-router.js';

// ASCII art banner with version
const separator = '============================='
const CLIIntro = () => {
  console.log(chalk.hex('#7C19DE').bold(` #####                     #######                                                   
#     # #      #   ##      #       #    # #    #  ####  ##### #  ####  #    #  ####  
#       #      #  #  #     #       #    # ##   # #    #   #   # #    # ##   # #      
#  #### #      # #    #    #####   #    # # #  # #        #   # #    # # #  #  ####  
#     # #      # ######    #       #    # #  # # #        #   # #    # #  # #      # 
#     # #      # #    #    #       #    # #   ## #    #   #   # #    # #   ## #    # 
 #####  ###### # #    #    #        ####  #    #  ####    #   #  ####  #    #  ####  `))
  console.log(chalk.italic(`v${getCliVersion()}`))
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
  }

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
      case 'exit': 
        console.log(chalk.green('Exiting Glia Functions CLI. Goodbye!'));
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
      message: 'API key:'
    });

    const APISecret = await input({  
      name: 'APISecret',
      message: 'API secret:'
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

    const confirmDetails = await confirm({ 
      message: 'Do you want to proceed with the above details? This will overwrite your current settings.' 
    });

    if (confirmDetails) {
      let env = ``;
      const url = Environment === 'beta' ? 'https://api.beta.glia.com' : 'https://api.glia.com';
      env += `GLIA_KEY_ID = ${APIKey}\n`;
      env += `GLIA_KEY_SECRET = ${APISecret}\n`;
      env += `GLIA_SITE_ID = ${SiteID}\n`;
      env += `GLIA_API_URL = ${url}\n`;

      try {
        // Create a temporary API client to generate token
        const tokenInfo = await createBearerToken(APIKey, APISecret, url);
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
        
        // Ask if user wants to store credentials globally
        const storeGlobally = await confirm({ 
          message: 'Would you like to store these credentials globally (in ~/.glia-cli/config.env) to use across all projects?',
          default: true
        });
        
        if (storeGlobally) {
          await updateGlobalConfig({
            'GLIA_KEY_ID': APIKey,
            'GLIA_KEY_SECRET': APISecret,
            'GLIA_SITE_ID': SiteID,
            'GLIA_API_URL': url,
            'GLIA_BEARER_TOKEN': tokenInfo.token,
            'GLIA_TOKEN_EXPIRES_AT': tokenInfo.expiresAt
          });
          
          showSuccess('Configuration saved locally and globally');
          showInfo('Settings written to .env file and ~/.glia-cli/config.env.');
        } else {
          showSuccess('Configuration saved locally');
          showInfo('Settings written to .env file.');
        }

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
 * @returns {Promise<Object>} Object containing token and expiration
 */
async function createBearerToken(keyId, keySecret, apiUrl) {
  try {
    if (!keyId || !keySecret) {
      throw new AuthenticationError('API key ID and secret are required');
    }
    
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    
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
    
    // Calculate expiration time (tokens typically expire after 24 hours)
    // If the API doesn't provide an expiration time, we'll set a default of 23.5 hours
    // to be safe and allow for refresh before actual expiration
    const expiresInMs = data.expires_in ? data.expires_in * 1000 : 23.5 * 60 * 60 * 1000;
    const expiresAt = Date.now() + expiresInMs;
    
    return {
      token: data.token,
      expiresAt
    };
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
      authConfig.apiUrl || 'https://api.glia.com'
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
          name: 'Manage existing functions',
          value: 'CLIListFunctions',
          description: 'Build and deploy function versions, access function logs, see usage statistics.',
        },
        {
          name: '(Back)',
          value: 'back'
        }
      ]
    });

    switch(answer) {
      case 'CLINewFunction': await CLINewFunction(); return false;
      case 'CLIListFunctions': await CLIListFunctions(); return false;
      case 'back': await CLIMainMenu(); return false;
    }
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

    const confirmDetails = await confirm({ 
      message: 'Proceed with above details?' 
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
    console.log(chalk.blue('Fetching functions list...'));
    
    try {
      // Get API configuration
      const apiConfig = await getApiConfig();
      
      // Check if configuration looks reasonable 
      const configIssues = validateApiConfiguration(apiConfig);
      if (configIssues.length > 0) {
        console.error(chalk.yellow('⚠️ Configuration warning: Issues found with API configuration:'));
        configIssues.forEach(issue => {
          console.error(chalk.yellow(`  • ${issue}`));
        });
        console.error(chalk.yellow('\nYou may need to re-run the setup process to fix these issues.'));
        console.error(chalk.yellow('Attempting to continue anyway...'));
      }
      
      // Try to retrieve the site details first to validate the token and site ID
      try {
        // Create simple fetch request to test connectivity
        const connectivityTest = await fetch(`${apiConfig.apiUrl}/sites/${apiConfig.siteId}`, {
          headers: {
            'Authorization': `Bearer ${apiConfig.bearerToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.salemove.v1+json'
          }
        });
        
        if (!connectivityTest.ok) {
          throw new Error(`Connection test failed with status ${connectivityTest.status}: ${connectivityTest.statusText}`);
        }
      } catch (connectError) {
        console.error(chalk.red('Connection test failed:'), connectError.message);
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
        console.error(chalk.red('Error while fetching functions:'));
        console.error(chalk.red(`Error type: ${apiError.constructor.name}`));
        console.error(chalk.red(`Error message: ${apiError.message}`));
        
        if (apiError.code) {
          console.error(chalk.red(`Error code: ${apiError.code}`));
        }
        
        if (apiError.details) {
          console.error(chalk.red('Error details:'), apiError.details);
        }
        
        if (apiError.endpoint) {
          console.error(chalk.red(`Endpoint: ${apiError.endpoint}`));
        }
        
        if (apiError.statusCode) {
          console.error(chalk.red(`Status code: ${apiError.statusCode}`));
        }
        
        // Handle different error types
        if (apiError instanceof NetworkError) {
          showWarning('Network error while fetching functions list');
          console.error(chalk.red('Network Error:'), apiError.message);
        } else if (apiError instanceof AuthenticationError) {
          showWarning('Authentication error - your token may be invalid or expired');
          console.error(chalk.red('Auth Error:'), apiError.message);
          
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
      console.error(chalk.red('Configuration error:'), configError.message);
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
    console.error(chalk.red('Unexpected error:'), error);
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
    console.log(chalk.bold('Function details:'));
    
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
      case 'functionVersions': await CLIFunctionVersions(functionId, functionDetails.current_version); return false;
      case 'functionInvoke': await CLIFunctionInvoke(functionId, functionDetails.invocation_uri); return false;
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
    }));

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
    console.log(chalk.bold('Function version details:'));
    
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
          name: '(Back)',
          value: 'back'
        }
      ]
    });
    
    switch(answer) {
      case 'deployFunction': await CLIDeployFunction(functionId, versionId); return false;
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
 * View function logs
 * 
 * @param {string} functionId - Function ID
 */
const CLIFunctionLogs = async (functionId) => {
  try {
    console.log(separator);
    console.log(chalk.bold('Function logs:'));
    
    // Get API configuration
    const apiConfig = await getApiConfig();
    
    // Create API client
    const api = new GliaApiClient(apiConfig);
    
    // Get logs
    const logs = await api.getFunctionLogs(functionId);
    
    process.stdout.write(JSON.stringify(logs, null, 2));
    
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
    console.log(chalk.bold('Function response:'));
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
    
    // Check if we have valid API configuration
    const hasToken = await hasValidBearerToken();
    
    if (hasToken) {
      // If user has a valid token, skip the main menu and go directly to the build menu
      console.log(chalk.green('✓ Existing authentication detected, skipping setup...'));
      await CLIBuildMenu();
    } else {
      // No valid token, show regular menu
      await CLIMainMenu();
    }
    
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

// Export createBearerToken for use in bin/glia-functions.js
export { createBearerToken };
