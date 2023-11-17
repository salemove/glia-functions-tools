import createVisitor from "./promises/createVisitor.js";
import createSiteBearerToken from "./promises/createSiteBearerToken.js";
import createQueueTicket from "./promises/createQueueTicket.js";
import sendMessageToGlia from "./promises/sendMessageToGlia.js";
import updateEngagement from "./promises/updateEngagement.js";

const delay = ms => new Promise(res => setTimeout(res, ms));

const callbackWidget = async (bearer, engagementId, visitor) => {
    const phoneNumber = visitor.phone;
    const siteBearer = await createSiteBearerToken(env.GLIA_SITE_KEY_ID, env.GLIA_SITE_KEY_SECRET);
    const newVisitor = await createVisitor(siteBearer);
    console.log('requesting call back by creating a queue ticket');
    await createQueueTicket(newVisitor.access_token, phoneNumber);

    const messageContent = `Your callback is now queued. We will call you as soon as we can. Goodbye!`;
    const ssmlContent = `<speak>Ok... <break time="3s"/>${messageContent}</speak>`;
    const contentMessage = {
        type: "suggestion",
        content: ssmlContent
    };
    console.log('sending message with REST API');
    await sendMessageToGlia(bearer, engagementId, messageContent);
    await delay(6000);
    console.log('ending engagement with REST API');
    await updateEngagement(bearer, engagementId, {
        action: "end",
        reason: "operator_hung_up"
    })
    
    const responseBody = {
        confidence_level: 0.99,
        messages: [contentMessage]
    };
    return {
        statusCode: 200,
        headers: {},
        body: JSON.stringify(responseBody, null, 2)
    }
};

export default callbackWidget;