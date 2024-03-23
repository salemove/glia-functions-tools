import { select, input, confirm } from '@inquirer/prompts';
import createBearerToken from "../utils/promises/createBearerToken.js";
import fs from "fs";

const CLISetup = async (CLIMainMenu) => {
	
	const APIKey = await input({	
			name: 'APIKey',
			message: 'API key:'
		});

	const APISecret = await	input({	
			name: 'APISecret',
			message: 'API secret:'
		});
		
	const SiteID = await input({	
			type: 'input',
			name: 'SiteID',
			message: 'Site ID:'
		});

	const Environment = await select({
			message: 'Choose environment:',
			choices: [{ 
				name: 'Production',
				value: 'production'
			}, {
				name: 'Beta',
				value: 'beta'
			}]
		});

	const confirmDetails = await (confirm({ message: 'Do you want to proceed with the above details? This will overwrite your current settings.' }))

	if (confirmDetails) {
	
		let env = ``;
		const url = Environment === 'beta' ? 'https://api.beta.glia.com' : 'https://api.glia.com';
		env += `GLIA_KEY_ID = ${APIKey}\n`;
		env += `GLIA_KEY_SECRET = ${APISecret}\n`;
		env += `GLIA_SITE_ID = ${SiteID}\n`;
		env += `GLIA_API_URL = ${url}\n`;

		const token = await createBearerToken(APIKey, APISecret, url);
		env += `GLIA_BEARER_TOKEN = ${token}\n`;

		await fs.writeFileSync('.env', env);
		
		console.log('>', chalk.green('Done.'))
		console.log('> Settings written to .env file.')

		CLIMainMenu();
		return false;

	}
};

export default CLISetup;