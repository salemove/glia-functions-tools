// example script to create a function, function version, and deploy a version
import createBearerToken from './utils/promises/createBearerToken.js';
import createGliaFunction from './utils/create-gf.js'; 
import createGfVersion from './utils/create-gf-version.js'
import listGliaFunctions from './utils/list-gfs.js'
import fetchTask from './utils/fetch-task.js';
import fetchVersion from './utils/fetch-version.js';
import fetchVersions from './utils/fetch-versions.js';
import fetchGf from './utils/fetch-function.js';
import fetchGfLogs from './utils/fetch-logs.js';
import deployGf from './utils/deploy-gf.js'
import invokeGf from './utils/invoke-gf.js'

import * as fs from 'fs';
import { execSync } from 'child_process';
import { input, select, confirm, editor } from '@inquirer/prompts';
import chalk from 'chalk';

import dotenv from 'dotenv';
dotenv.config();

const separator = '============================='
const CLIIntro = () => {

	console.log(chalk.hex('#7C19DE').bold(` #####                     #######                                                   
#     # #      #   ##      #       #    # #    #  ####  ##### #  ####  #    #  ####  
#       #      #  #  #     #       #    # ##   # #    #   #   # #    # ##   # #      
#  #### #      # #    #    #####   #    # # #  # #        #   # #    # # #  #  ####  
#     # #      # ######    #       #    # #  # # #        #   # #    # #  # #      # 
#     # #      # #    #    #       #    # #   ## #    #   #   # #    # #   ## #    # 
 #####  ###### # #    #    #        ####  #    #  ####    #   #  ####  #    #  ####  `))
	console.log(chalk.italic('v0.1.0'))
	console.log(separator)

}

const CLIMainMenu = async () => {

	let choices = [
		{
      name: 'Setup project',
      value: 'setup',
      description: 'Setup the environment for further requests and generate a bearer token',
    }
	]

	if (process.env.GLIA_SITE_ID) {
		choices.push({
      name: 'Authenticate CLI',
      value: 'auth',
      description: '(Re)Generate a new bearer token',
    })
	}

	if (process.env.GLIA_BEARER_TOKEN) {
		choices.push({
      name: 'Manage & build functions',
      value: 'build',
      description: 'Build or update a function',
    })
	}

	choices.push({
	  name: '(Exit)',
	  value: 'exit'
  })	

	select({
	  message: 'Select action:',
	  choices
	})
	.then(answer => {
		switch(answer) {

			case 'setup': CLISetup(); return false;
			case 'auth': CLIAuth();  return false;
			case 'build': CLIBuildMenu(); return false;
			case 'exit': return false;

		}
	})

}

const CLISetup = async () => {
	
	const APIKey = await input({	
			name: 'APIKey',
			message: 'API key:'
		});

	const APISecret = await	input({	
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

	const confirmDetails = await (confirm({ message: 'Do you want to proceed with the above details? This will overwrite your current settings.' }))

	if (confirmDetails) {
	
		let env = ``;
		const url = Environment === 'beta' ? 'https://api.beta.glia.com' : 'https://api.glia.com';
		env += `GLIA_KEY_ID = ${APIKey}\n`;
		env += `GLIA_KEY_SECRET = ${APISecret}\n`;
		env += `GLIA_SITE_ID = ${SiteID}\n`;
		env += `GLIA_API_URL = ${url}\n`;

		const token = await createBearerToken(APIKey, APISecret, url);
		env += `GLIA_BEARER_TOKEN = ${token}\n`;

		await fs.writeFileSync('.env', env);
		
		console.log('>', chalk.green('Done.'))
		console.log('> Settings written to .env file.')

		CLIMainMenu();
		return false;

	}

};

const CLIAuth = async () => {
	const envBuffer = await fs.readFileSync('.env');
  let env = '' + envBuffer;

	const token = await createBearerToken(process.env.GLIA_KEY_ID, process.env.GLIA_KEY_SECRET, process.env.GLIA_API_URL);
	env = env.replace(/GLIA_BEARER_TOKEN = (.*)\n/g, `GLIA_BEARER_TOKEN = ${token}\n`)

	await fs.writeFileSync('.env', env);

	console.log('> New bearer token written to .env file.');
	console.log('>', chalk.green('Done.'));

	CLIMainMenu();
	return false;
};

const CLIBuildMenu = async () => {

	select({
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
	})
	.then(answer => {
		switch(answer) {

			case 'CLINewFunction': CLINewFunction(); return false;
			case 'CLIListFunctions': CLIListFunctions(); return false;
			case 'back': CLIMainMenu(); return false;
		
		}
	})

}

const CLINewFunction = async () => {

	const functionName = await input({	
			name: 'functionName',
			message: 'Function name:'
		});

	const functionDescription = await input({	
			name: 'functionDescription',
			message: 'Function description:'
		});

	const confirmDetails = await (confirm({ message: 'Proceed with above details?' }));

	if (confirmDetails) {
		const newGliaFunction = await createGliaFunction(process.env.GLIA_SITE_ID, functionName, functionDescription);

		console.log('> New Glia Function successfully created.');
		console.log('>', chalk.green('Done.'));
	}
	else {

		console.log('> Canceled.');
		CLIBuildMenu();
		return false;

	}

}

const CLINewVersion = async (functionSelect) => {

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
	})

	let environmentVariables = false;
	if (passEnvVariables) {

		environmentVariables = await editor({
		  message: 'Enter environment variables as JSON:',
			default: '{\n\n}',
			postfix: '.js'
		});

		try {

			console.log(JSON.parse(environmentVariables))
			console.log('> Appending environment variables.');

		} catch(err) {

			console.log(chalk.red('> Invalid JSON format.'));
			console.log('> Canceled.');
			CLIFunctionDetailsMenu(functionSelect);
			return false;

		}

	}

	const confirmDetails = await (confirm({ message: 'Proceed with above details?' }));

	if (confirmDetails) {
	
		execSync('npm run build ' + fileSelect);
		console.log('> File bundled.');

		const gfVersion = await createGfVersion(
			functionSelect, './function-out.js', 
			compatibilityDate === 'latest' ? false : compatibilityDate,
			!environmentVariables ? false : JSON.parse(environmentVariables)
		);
		console.log('> Function version creation tasked enqueued.');
		console.log('>', chalk.green('Done.'));

	}
	else {

		console.log('> Canceled.');
		CLIFunctionDetailsMenu(functionSelect);
		return false;

	}

}

const CLIDeployFunction = async (functionSelect, versionSelect) => {

	const gfDeployment = await deployGf(functionSelect, versionSelect);
	console.log('> Deploying function version.');
	console.log('> Writing audit logs.');
	console.log('>', chalk.green('Done.'));

}

const CLIFunctionLogs = async (functionSelect) => {

	console.log(separator)
	console.log(chalk.bold('Function logs:'));

	const version = await fetchGfLogs(functionSelect);
	console.log(version.logs);

	CLIFunctionDetailsMenu(functionSelect);	
	return false;

}

const CLIFunctionVersion = async (functionSelect, versionSelect) => {

	console.log(separator)
	console.log(chalk.bold('Function version details:'));

	const version = await fetchVersion(functionSelect, versionSelect);
	console.log(version);

	console.log(separator)
	select({
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
	})
	.then(answer => {
		switch(answer) {

			case 'deployFunction': CLIDeployFunction(functionSelect, versionSelect); return false;
			case 'back': CLIFunctionDetailsMenu(functionSelect); return false;

		}
	})

}

const CLIFunctionVersions = async (functionSelect, current_version) => {

	let choices = []
	const versions = await fetchVersions(functionSelect);
	for (let item of versions.function_versions) {
		choices.push({
			name: `${current_version && current_version.id === item.id ? '(current)' : ''} ${item.id} (created at ${item.created_at})`,
			value: item.id,
	  })
	}

	const versionSelect = await select({
	  message: 'Function versions:',
	  choices: [
	    ...choices,
	    {
				name: '(Back)',
				value: 'back',
	  	}
	  ]
	})

	if (versionSelect === 'back') {
		CLIFunctionDetailsMenu(functionSelect);
		return false;
	}

	CLIFunctionVersion(functionSelect, versionSelect)

}

const CLIFunctionInvoke = async (functionSelect, invocationUri) => {

	const passPayload = await confirm({
		message: 'Add custom payload?'
	})

	let payload;

	if (passPayload) {

		payload = await editor({
		  message: 'Enter payload:',
		});

		console.log('> Appending custom payload.');

	}

	console.log('> Invoking function.');
	const response = await invokeGf(invocationUri, payload);

	console.log(separator);
	console.log(chalk.bold('Function response:'));
	console.log(response);

	CLIFunctionDetailsMenu(functionSelect);
	return false;

}

const CLIFunctionDetailsMenu = async (functionSelect) => {

	console.log(separator)
	console.log(chalk.bold('Function details:'))

	const functionDetails = await fetchGf(functionSelect)
	console.log(functionDetails)
	console.log(separator)

	select({
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
	})
	.then(answer => {
		switch(answer) {

			case 'functionLogs': CLIFunctionLogs(functionSelect); return false;
			case 'newVersion': CLINewVersion(functionSelect); return false;
			case 'functionVersions': CLIFunctionVersions(functionSelect, functionDetails.current_version); return false;
			case 'functionInvoke': CLIFunctionInvoke(functionSelect, functionDetails.invocation_uri); return false;
			case 'back': CLIBuildMenu(); return false; // alternative CLIListFunctions()

		}
	})

}

const CLIListFunctions = async () => {

	let choices = []
	const list = await listGliaFunctions()
	for (let item of list.functions) {
		choices.push({
			name: item.name,
			value: item.id,
	  })
	}

	const functionSelect = await select({
	  message: 'Select function:',
	  choices: [
	    ...choices,
	    {
				name: '(Back)',
				value: 'back',
	  	}
	  ]
	})

	if (functionSelect === 'back') {
		CLIBuildMenu();
		return false;
	}

	CLIFunctionDetailsMenu(functionSelect)

}

CLIIntro();
CLIMainMenu();
