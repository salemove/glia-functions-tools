import chalk from 'chalk';
import { logNetworkError } from '../utils/logging.js';
import fetchGfLogs from '../utils/fetch-logs.js'
import CLIFunctionDetailsMenu from './cliFunctionDetailsMenu.js';

const separator = '============================='

const CLIFunctionLogs = async (functionSelect) => {
	console.log(separator)
	console.log(chalk.bold('Function logs:'));
	try {
		const logs = await fetchGfLogs(functionSelect);
		process.stdout.write(JSON.stringify(logs, null, 2));
	} catch(error) {
		logNetworkError(error);
		console.log(error)
		return false;
	}
	CLIFunctionDetailsMenu(functionSelect);	
	return false;
}

export default CLIFunctionLogs;