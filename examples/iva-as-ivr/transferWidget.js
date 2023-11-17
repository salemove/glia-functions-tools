import { transferToQueue, buildResponseBody } from './utils/gliaAi';

const transferWidget = async (queueId) => {
    const media = "audio";
    const notifications = {
        "success": "I am transferring you to one of our operators, please wait",
        "failure": "I can't transfer you, the queue is closed at the moment",
        "transfer_already_ongoing": "I am already transferring you, please wait"
    };
    // const responseBody = buildResponseBody(0.99, [transferToQueue(media, queueId, notifications)]);
    const responseBody = buildResponseBody(0.99, [
        {"type": "suggestion","content": "Transferring...","metadata": {"incident_id": "INC000011303513"}},
        transferToQueue(media, queueId)
    ]);
    return {
        statusCode: 200,
        headers: {},
        body: JSON.stringify(responseBody, null, 2)
    }
}

export default transferWidget;