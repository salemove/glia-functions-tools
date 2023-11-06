// example script to create a function, function version, and deploy a version

import createBearerToken from './utils/promises/createBearerToken.js';
import createGliaFunction from './utils/create-gf.js'; 
import createGfVersion from './utils/create-gf-version.js'
import listGliaFunctions from './utils/list-gfs.js'
import fetchTask from './utils/fetch-task.js';
import fetchVersion from './utils/fetch-version.js';

import * as fs from 'fs';
import { Command } from 'commander';

import dotenv from 'dotenv';
dotenv.config();

const program = new Command();

program
  .name('Glia Functions CLI')
  .description('CLI for building Glia Functions')
  .version('0.1.0');

program
	.command('setup')
	.description('Setup the environment for further requests and authenticate')
	.argument('<API_KEY>', 'User API key')
	.argument('<API_SECRET>', 'User API secret')
	.argument('<SITE_ID>', 'Glia site ID')
	.argument('[API_BETA]', 'Use beta API?', false)
	.action(async (API_KEY, API_SECRET, SITE_ID, API_BETA) => {

		let env = ``
		const url = API_BETA ? 'https://api.beta.glia.com' : 'https://api.glia.com'
		env += `GLIA_KEY_ID = ${API_KEY}\n`
		env += `GLIA_KEY_SECRET = ${API_SECRET}\n`
		env += `GLIA_SITE_ID = ${SITE_ID}\n`
		env += `GLIA_API_URL = ${url}\n`

		const token = await createBearerToken(API_KEY, API_SECRET, url);
		env += `GLIA_BEARER_TOKEN = ${token}\n`

		await fs.writeFileSync('.env', env);
		console.log('Wrote to .env')

	})

program
	.command('auth')
	.description('Generate a new bearer token')
	.action(async () => {

		const envBuffer = await fs.readFileSync('.env');
    let env = '' + envBuffer;

		const token = await createBearerToken(process.env.GLIA_KEY_ID, process.env.GLIA_KEY_SECRET, process.env.GLIA_API_URL);
		env = env.replace(/GLIA_BEARER_TOKEN = (.*)\n/g, `GLIA_BEARER_TOKEN = ${token}\n`)

		await fs.writeFileSync('.env', env);

	})

program
	.command('functions:create')
	.description('Create a new Glia Function')
	.argument('<FUNCTION_NAME>', 'Name of the function')
	.argument('[FUNCTION_DESCRIPTION]', 'Description of the function', 'My Glia Function')
	.action(async (FUNCTION_NAME, FUNCTION_DESCRIPTION) => {

		if (!process.env.GLIA_BEARER_TOKEN) {
			program.error('Missing Bearer token, run `auth` command first');
			return false
		}

		const newGliaFunction = await createGliaFunction(process.env.GLIA_SITE_ID, FUNCTION_NAME, FUNCTION_DESCRIPTION)
		console.log('Created new Glia Function')
		console.log(newGliaFunction)

	})

program
	.command('functions:version')
	.description('Create a new function version')
	.argument('<FUNCTION_ID>', 'ID of the function')
	.argument('<BUNDLE_PATH>', 'Path of the bundled function')
	.argument('[COMPATIBILITY_DATE]', 'Compatibility date (YYYY-MM-DD)', (new Date()).toISOString().split('T')[0])
	.action(async (FUNCTION_ID, BUNDLE_PATH, COMPATIBILITY_DATE) => {

		if (!process.env.GLIA_BEARER_TOKEN) {
			program.error('Missing Bearer token, run `auth` command first');
			return false
		}

		const gfVersion = await createGfVersion(FUNCTION_ID, BUNDLE_PATH, COMPATIBILITY_DATE)
		console.log('Created new function version')
		console.log(gfVersion)

	})

program
	.command('functions:task')
	.description('Fetch task status for a specific function version')
	.argument('<TASK_PATH>', 'PATH of the function version task, returned as self key')
	.action(async (TASK_PATH) => {

		if (!process.env.GLIA_BEARER_TOKEN) {
			program.error('Missing Bearer token, run `auth` command first');
			return false
		}

		const gfVersionTask = await fetchTask(TASK_PATH);
		console.log(gfVersionTask)

	})

program
	.command('functions:version-get')
	.description('Fetch function version details')
	.argument('<FUNCTION_ID>', 'ID of the function')
	.argument('<VERSION_ID>', 'ID of the function version')
	.action(async (FUNCTION_ID, VERSION_ID) => {

		if (!process.env.GLIA_BEARER_TOKEN) {
			program.error('Missing Bearer token, run `auth` command first');
			return false
		}

		const response = await fetchVersion(FUNCTION_ID, VERSION_ID);
		console.log(response)

	})

program
	.command('functions:list')
	.description('List all functions')
	.action(async () => {

		if (!process.env.GLIA_BEARER_TOKEN) {
			program.error('Missing Bearer token, run `auth` command first');
			return false
		}

		const list = await listGliaFunctions()
		console.log(list)

	})


program
	.parse();

/*

import fetchTask from './utils/fetch-task.js';
import deployGf from './utils/deploy-gf.js'

const bundledFunctionPath = './function.js'


await new Promise(r => setTimeout(r, 9000));

const gfVersionTask = await fetchTask(gliaBearerToken, gfVersion.self);

const gfDeployment = await deployGf(gliaBearerToken, newGliaFunction.id, gfVersionTask.entity.id)

console.log(gfDeployment)*/
