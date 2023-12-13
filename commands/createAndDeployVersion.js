import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
const argv = yargs(hideBin(process.argv)).argv;
import createBearerToken from '../utils/promises/createBearerToken.js';
import createGfVersion from '../utils/create-gf-version.js';
import fetchTask from '../utils/fetch-task.js';
import deployGf from '../utils/deploy-gf.js';

const createAndDeployVersion = async (functionId, functionCodePath, envVars) => {
    const gliaBearerToken = await createBearerToken(process.env.GLIA_KEY_ID, process.env.GLIA_KEY_SECRET);
    const gfVersion = await createGfVersion(gliaBearerToken, functionId, functionCodePath, envVars)
    console.log('New version created: ', gfVersion)
    await new Promise(r => setTimeout(r, 60000));
    const gfVersionTask = await fetchTask(gliaBearerToken, gfVersion.self);
    console.log(gfVersionTask)
    const gfDeployment = await deployGf(gliaBearerToken, functionId, gfVersionTask.entity.id)
    console.log('New deployment successful: ', gfDeployment)
    return gfDeployment
}

createAndDeployVersion(argv.id, argv.path, argv.env)