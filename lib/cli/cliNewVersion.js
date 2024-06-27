import chalk from 'chalk';
import { input, confirm, editor } from '@inquirer/prompts';
import { logNetworkError } from '../utils/logging.js';
import CLIFunctionDetailsMenu from './cliFunctionDetailsMenu.js';

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
			logNetworkError(error);
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

export default CLINewVersion;