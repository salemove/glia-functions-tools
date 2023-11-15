import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
const argv = yargs(hideBin(process.argv)).argv;
import createBearerToken from '../utils/promises/createBearerToken.js';
import createGliaFunction from '../utils/create-gf.js';

const createGf = async (name, description) => {
    const gliaBearerToken = await createBearerToken(process.env.GLIA_KEY_ID, process.env.GLIA_KEY_SECRET);
    const gliaFunction = await createGliaFunction(gliaBearerToken, process.env.GLIA_SITE_ID, name, description)
    console.log('New function created: ', gliaFunction)
    return gliaFunction
}

createGf(argv.name, argv.description)