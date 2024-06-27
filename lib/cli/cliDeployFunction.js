import chalk from 'chalk';
import { logNetworkError } from '../utils/logging.js';
import deployGf from '../utils/deploy-gf.js';

const CLIDeployFunction = async (functionSelect, versionSelect) => {
	try {
		const gfDeployment = await deployGf(functionSelect, versionSelect);
	} catch(error) {
		logNetworkError(error);
		return false;
	}

	console.log('> Deploying function version.');
	console.log('> Writing audit logs.');
	console.log('>', chalk.green('Done.'));
}

export default CLIDeployFunction;