import { logNetworkError } from '../utils/logging.js';
import fetchVersions from '../utils/fetch-versions.js';
import CLIFunctionDetailsMenu from './cliFunctionDetailsMenu.js';
import CLIFunctionVersion from './cliFunctionVersion.js';
import { select } from '@inquirer/prompts';

const CLIFunctionVersions = async (functionSelect, current_version) => {

	let versions;
	try {
		versions = await fetchVersions(functionSelect);
	} catch(error) {
		logNetworkError(error);
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

export default CLIFunctionVersions;