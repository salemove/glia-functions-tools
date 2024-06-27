import { select } from '@inquirer/prompts';
import CLIListFunctions from './cliListFunctions.js';
import CLIMainMenu from './cliMainMenu.js';

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
			case 'back': CLIMainMenu(); return false;
		
		}
	})
}

export default CLIBuildMenu