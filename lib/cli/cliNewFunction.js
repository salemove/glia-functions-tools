import chalk from 'chalk';
import { input, confirm } from '@inquirer/prompts';
import { logNetworkError } from '../utils/logging.js';
import createGliaFunction from '../utils/create-gf.js';
import CLIBuildMenu from './cliBuildMenu.js';

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
			logNetworkError(error);
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

export default CLINewFunction;