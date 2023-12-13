import fetchQueueWaitTime from "./promises/fetchQueueWaitTime.js";

const queueWaitWidget = async (bearer, siteId, queueId) => {
    const queueWaitTime = await fetchQueueWaitTime(bearer, siteId, queueId);

    const messageContent = `The average wait time is ${queueWaitTime.total} seconds. Press 1 to wait in the queue. To request a callback, please press 2.`;

    const message = {
        type: "suggestion",
        content: messageContent
    };
    const responseBody = {
        confidence_level: 0.99,
        messages: [message]
    };
    const stringifiedResponse = JSON.stringify(responseBody)
    console.log('response returned to Glia= ', stringifiedResponse)
    return new Response(stringifiedResponse)
}

export default queueWaitWidget;