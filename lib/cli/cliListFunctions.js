import { select } from '@inquirer/prompts';
import listGliaFunctions from '../utils/list-gfs.js';
import { logNetworkError } from '../utils/logging.js';
import CLIFunctionDetailsMenu from './cliFunctionDetailsMenu.js';

const CLIListFunctions = async () => {

	let list;
	try {
		list = await listGliaFunctions();
	} catch(error) {
		logNetworkError(error);
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

export default CLIListFunctions;