import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
const argv = yargs(hideBin(process.argv)).argv;
import createBearerToken from '../utils/promises/createBearerToken.js';
import fetchGfLogs from '../utils/fetch-logs.js';

const fetchLogsCommand = async (functionId) => {
    const gliaBearerToken = await createBearerToken(process.env.GLIA_KEY_ID, process.env.GLIA_KEY_SECRET);
    const logs = await fetchGfLogs(gliaBearerToken, functionId);
    console.log(logs)
    return logs
}

fetchLogsCommand(argv.id)