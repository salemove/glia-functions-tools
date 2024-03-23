import CLIIntro from './lib/cli/cliIntro.js';
import CLIMainMenu from './lib/cli/cliMainMenu.js';
import CLISetup from './lib/cli/cliSetup.js';
import CLIAuth from './lib/cli/cliAuth.js';

import createGliaFunction from './lib/utils/create-gf.js'; 
import createGfVersion from './lib/utils/create-gf-version.js'
import listGliaFunctions from './lib/utils/list-gfs.js'
import fetchVersion from './lib/utils/fetch-version.js';
import fetchVersions from './lib/utils/fetch-versions.js';
import fetchGf from './lib/utils/fetch-function.js';
import fetchGfLogs from './lib/utils/fetch-logs.js';
import deployGf from './lib/utils/deploy-gf.js'
import invokeGf from './lib/utils/invoke-gf.js'

import * as fs from 'fs';
import { execSync } from 'child_process';
import { input, select, confirm, editor } from '@inquirer/prompts';
import chalk from 'chalk';

import dotenv from 'dotenv';
dotenv.config();

const separator = '============================='

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
			case 'back': CLIMainMenu(CLISetup, CLIAuth, CLIBuildMenu); return false;
		
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

		try {
			const newGliaFunction = await createGliaFunction(process.env.GLIA_SITE_ID, functionName, functionDescription);
		} catch(error) {
			console.log(chalk.red('> Network error.'));
			return false;
		}

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

		try {
			const gfVersion = await createGfVersion(
				functionSelect, './function-out.js', 
				compatibilityDate === 'latest' ? false : compatibilityDate,
				!environmentVariables ? false : JSON.parse(environmentVariables)
			);

		} catch(error) {
			console.log(chalk.red('> Network error.'));
			return false;
		}

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

	try {
		const gfDeployment = await deployGf(functionSelect, versionSelect);
	} catch(error) {
		console.log(chalk.red('> Network error.'));
		return false;
	}

	console.log('> Deploying function version.');
	console.log('> Writing audit logs.');
	console.log('>', chalk.green('Done.'));

}

const CLIFunctionLogs = async (functionSelect) => {

	console.log(separator)
	console.log(chalk.bold('Function logs:'));

	try {
		const logs = await fetchGfLogs(functionSelect);
		process.stdout.write(JSON.stringify(logs, null, 2));
	} catch(error) {
		console.log(chalk.red('> Network error.'));
		console.log(error)
		return false;
	}

	CLIFunctionDetailsMenu(functionSelect);	
	return false;

}

const CLIFunctionVersion = async (functionSelect, versionSelect) => {

	console.log(separator)
	console.log(chalk.bold('Function version details:'));

	let version;
	try {
		version = await fetchVersion(functionSelect, versionSelect);
	} catch(error) {
		console.log(chalk.red('> Network error.'));
		return false;
	}

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

	let versions;
	try {
		versions = await fetchVersions(functionSelect);
	} catch(error) {
		console.log(chalk.red('> Network error.'));
		return false;
	}

	let choices = []
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

		try {

			console.log(JSON.parse(payload))
			console.log('> Appending custom payload.');

		} catch(err) {

			console.log(chalk.red('> Invalid JSON format.'));
			console.log('> Canceled.');
			CLIFunctionDetailsMenu(functionSelect);
			return false;

		}

	}

	console.log('> Invoking function.');

	let response;
	try {
		response = await invokeGf(invocationUri, payload);
	} catch(error) {
		console.log(chalk.red('> Network error.'));
		return false;
	}

	console.log(separator);
	console.log(chalk.bold('Function response:'));
	console.log(response);

	CLIFunctionDetailsMenu(functionSelect);
	return false;

}

const CLIFunctionDetailsMenu = async (functionSelect) => {

	console.log(separator)
	console.log(chalk.bold('Function details:'))

	let functionDetails;
	try {
		functionDetails = await fetchGf(functionSelect)
	} catch(error) {
		console.log(chalk.red('> Network error.'));
		return false;
	}

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

	let list;
	try {
		list = await listGliaFunctions();
	} catch(error) {
		console.log(chalk.red('> Network error.'));
		return false;
	}

	let choices = []
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

CLIIntro(separator);
CLIMainMenu(CLISetup, CLIAuth, CLIBuildMenu);
