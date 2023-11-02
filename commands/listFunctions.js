import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
const argv = yargs(hideBin(process.argv)).argv;
import createBearerToken from '../utils/promises/createBearerToken.js';
import listFunctions from '../utils/list-functions.js';

const listFunctionsCommand = async () => {
    const gliaBearerToken = await createBearerToken(process.env.GLIA_KEY_ID, process.env.GLIA_KEY_SECRET);
    const functions = await listFunctions(gliaBearerToken, process.env.GLIA_SITE_ID)
    return functions
}

listFunctionsCommand()