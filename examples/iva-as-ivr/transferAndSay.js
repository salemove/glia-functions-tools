import transferToQueue from './promises/transferToQueue.js';
import sendMessageToGlia from './promises/sendMessageToGlia.js';
import { sleep } from './utils/helpers.js'

const transferAndSay = async (bearer, spanishIvaBearerToken, engagementId, queueId, media, transferMessage, promptMessage ) => {
    console.log('invoking transfer to queue');
    const transfer = await transferToQueue(bearer, engagementId, queueId, media, transferMessage)
    console.log('completed transfer: ', transfer);
    await sleep(1500)
    const promptTheCaller = await sendMessageToGlia(spanishIvaBearerToken, engagementId, promptMessage);
    console.log('Glia said this to the caller: ', promptTheCaller)
    return new Response(JSON.stringify({}))
}

export default transferAndSay;