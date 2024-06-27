import { select } from '@inquirer/prompts';
import CLIAuth from './cliAuth.js';
import CLISetup from './cliSetup.js';
import CLIBuildMenu from './cliBuildMenu.js';

const CLIMainMenu = async () => {

	let choices = [
		{
      name: 'Setup project',
      value: 'setup',
      description: 'Setup the environment for further requests and generate a bearer token',
    }
	]

	if (process.env.GLIA_SITE_ID) {
		choices.push({
      name: 'Authenticate CLI',
      value: 'auth',
      description: '(Re)Generate a new bearer token',
    })
	}

	if (process.env.GLIA_BEARER_TOKEN) {
		choices.push({
      name: 'Manage & build functions',
      value: 'build',
      description: 'Build or update a function',
    })
	}

	choices.push({
	  name: '(Exit)',
	  value: 'exit'
  })	

	select({
	  message: 'Select action:',
	  choices
	})
	.then(answer => {
		switch(answer) {

			case 'setup': CLISetup(); return false;
			case 'auth': CLIAuth();  return false;
			case 'build': CLIBuildMenu(); return false;
			case 'exit': return false;

		}
	})
}

export default CLIMainMenu;