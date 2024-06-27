import createBearerToken from "../utils/promises/createBearerToken.js";
import fs from "fs";
import chalk from "chalk";

const CLIAuth = async () => {
	const envBuffer = await fs.readFileSync('.env');
  let env = '' + envBuffer;

	const token = await createBearerToken(process.env.GLIA_KEY_ID, process.env.GLIA_KEY_SECRET, process.env.GLIA_API_URL);
	env = env.replace(/GLIA_BEARER_TOKEN = (.*)\n/g, `GLIA_BEARER_TOKEN = ${token}\n`)

	await fs.writeFileSync('.env', env);

	console.log('> New bearer token written to .env file.');
	console.log('>', chalk.green('Done.'));

	return false;
};

export default CLIAuth