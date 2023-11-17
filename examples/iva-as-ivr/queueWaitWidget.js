import fetchQueueWaitTime from "./promises/fetchQueueWaitTime.js";

const queueWaitWidget = async (bearer) => {
    const queueWaitTime = await fetchQueueWaitTime(bearer, env.GLIA_TRANSFER_SITE_ID, env.GLIA_TRANSFER_QUEUE_ID);

    const messageContent = `The average wait time is ${queueWaitTime.total} seconds. Press 1 to wait in the queue. To request a callback, please press 2.`;

    const message = {
        type: "suggestion",
        content: messageContent
    };
    const responseBody = {
        confidence_level: 0.99,
        messages: [message]
    };
    return {
        statusCode: 200,
        headers: {},
        body: JSON.stringify(responseBody, null, 2)
    }
}

export default queueWaitWidget;