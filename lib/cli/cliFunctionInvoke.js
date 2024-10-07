import chalk from 'chalk';
import { confirm, editor } from '@inquirer/prompts';
import { logNetworkError } from '../utils/logging.js';
import CLIFunctionDetailsMenu from './cliFunctionDetailsMenu.js';
import invokeGf from '../utils/invoke-gf.js';

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
		logNetworkError(error);
		return false;
	}

	console.log(separator);
	console.log(chalk.bold('Function response:'));
	console.log(response);

	CLIFunctionDetailsMenu(functionSelect);
	return false;

}

export default CLIFunctionInvoke;