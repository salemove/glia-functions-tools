import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { logNetworkError } from '../utils/logging.js';
import fetchGf from '../utils/fetch-function.js';
import CLIBuildMenu from './cliBuildMenu.js';
import CLIFunctionLogs from './cliFunctionLogs.js';
import CLINewVersion from './cliNewVersion.js';

const separator = '============================='

const CLIFunctionDetailsMenu = async (functionSelect) => {

	console.log(separator)
	console.log(chalk.bold('Function details:'))

	let functionDetails;
	try {
		functionDetails = await fetchGf(functionSelect)
	} catch(error) {
		logNetworkError(error);
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

export default CLIFunctionDetailsMenu;