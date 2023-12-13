import sendSms from "./promises/sendSms.js";
import sendMessageToGlia from "./promises/sendMessageToGlia.js";
import updateEngagement from "./promises/updateEngagement.js";

const delay = ms => new Promise(res => setTimeout(res, ms));

const smsWidget = async (bearer, engagementId, visitor) => {
    const phoneNumber = visitor.phone;
    const fromNumber = '+12084694912';
    const smsMessage = 'Text us your question, or find the answer online at https://gliafinancial.com/';
    console.log('sending sms');
    await sendSms(bearer,fromNumber, phoneNumber, smsMessage);
    const voiceMessage = `Check your text messages. We sent you an SMS. Goodbye!`;
    const contentMessage = {type: "suggestion",content: voiceMessage};
    console.log('sending message with REST API');
    await sendMessageToGlia(bearer, engagementId, voiceMessage);
    await delay(6000);
    console.log('ending engagement with REST API');
    await updateEngagement(bearer, engagementId, {
        action: "end",
        reason: "operator_hung_up"
    })
    const responseBody = {confidence_level: 0.99,messages: [contentMessage]};
    return new Response(JSON.stringify(responseBody))
};

export default smsWidget;