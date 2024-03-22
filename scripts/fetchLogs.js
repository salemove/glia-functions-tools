import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
const argv = yargs(hideBin(process.argv)).argv;
import createBearerToken from '../utils/promises/createBearerToken.js';
import fetchGfLogs from '../utils/fetch-logs.js';
import fs from 'fs/promises'

const fetchLogsCommand = async (functionId) => {
    const gliaBearerToken = await createBearerToken(process.env.GLIA_KEY_ID, process.env.GLIA_KEY_SECRET);
    const logsRequestUrl = `https://api.glia.com/functions/${functionId}/logs`
    const logs = await fetchGfLogs(gliaBearerToken, logsRequestUrl);
    await fs.writeFile('./logs.json', JSON.stringify(logs))
    process.stdout.write(JSON.stringify(logs, null, 2));
    return logs
}

fetchLogsCommand(argv.id)