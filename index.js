// example script to create a function, function version, and deploy a version
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers'
const argv = yargs(hideBin(process.argv)).argv
import createBearerToken from './utils/promises/createBearerToken.js';
import createGliaFunction from './utils/create-gf.js'; 
import createGfVersion from './utils/create-gf-version.js'
import fetchTask from './utils/fetch-task.js';
import deployGf from './utils/deploy-gf.js'

const createAndDeployFunction = async (functionOutPath) => {
    const gliaBearerToken = await createBearerToken(process.env.GLIA_KEY_ID, process.env.GLIA_KEY_SECRET);

    const newGliaFunction = await createGliaFunction(gliaBearerToken, process.env.GLIA_SITE_ID, 'new fn name', 'new fn description')

    const gfVersion = await createGfVersion(gliaBearerToken, newGliaFunction.id, functionOutPath, '2023-10-12')

    await new Promise(r => setTimeout(r, 9000));

    const gfVersionTask = await fetchTask(gliaBearerToken, gfVersion.self);

    const gfDeployment = await deployGf(gliaBearerToken, newGliaFunction.id, gfVersionTask.entity.id)

    console.log(gfDeployment)
    return gfDeployment
}

createAndDeployFunction(argv.file)