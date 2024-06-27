import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { logNetworkError } from '../utils/logging.js';
import CLIDeployFunction from './cliDeployFunction.js';
import CLIFunctionDetailsMenu from './cliFunctionDetailsMenu.js';

const separator = '============================='

const CLIFunctionVersion = async (functionSelect, versionSelect) => {

	console.log(separator)
	console.log(chalk.bold('Function version details:'));

	let version;
	try {
		version = await fetchVersion(functionSelect, versionSelect);
	} catch(error) {
		logNetworkError(error);
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

export default CLIFunctionVersion;