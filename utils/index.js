import createBearerToken from './promises/createBearerToken.js';
import createGliaFunction from './create-gf.js'; 
import createGfVersion from './create-gf-version.js'
import fetchTask from './fetch-task.js';
import deployGf from './deploy-gf.js'

const bundledFunctionPath = '/Users/christian/Projects/glia-functions-alpha/function.js'

const gliaBearerToken = await createBearerToken(process.env.GLIA_KEY_ID, process.env.GLIA_KEY_SECRET);

const newGliaFunction = await createGliaFunction(gliaBearerToken, process.env.GLIA_SITE_ID, 'new fn name', 'new fn description')

const gfVersion = await createGfVersion(gliaBearerToken, newGliaFunction.id, bundledFunctionPath, '2023-10-12')

await new Promise(r => setTimeout(r, 9000));

const gfVersionTask = await fetchTask(gliaBearerToken, gfVersion.self);

const gfDeployment = await deployGf(gliaBearerToken, newGliaFunction.id, gfVersionTask.entity.id)

console.log(gfDeployment)