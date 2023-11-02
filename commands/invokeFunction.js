import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
const argv = yargs(hideBin(process.argv)).argv;
import createBearerToken from '../utils/promises/createBearerToken.js';
import invokeGliaFunction from '../utils/invoke-gf.js';

const invokeFunctionCommand = async (invocationUri, data) => {
    const gliaBearerToken = await createBearerToken(process.env.GLIA_KEY_ID, process.env.GLIA_KEY_SECRET);
    const result = invokeGliaFunction(gliaBearerToken, invocationUri, JSON.parse(data))
    console.log(result)
    return result
}

invokeFunctionCommand(argv.uri, argv.data)