import queueWaitWidget from './queueWaitWidget.js';
import callbackWidget from './callbackWidget.js';
import transferWidget from './transferWidget.js';
import smsWidget from './smsWidget.js';
import claimsWidget from './insurance/claimsWidget.js';
import createBearerToken from './promises/createBearerToken.js';
import fetchEngagement from './promises/fetchEngagement.js';
import fetchVisitor from './promises/fetchVisitor.js';
import updateVisitor from './promises/updateVisitor.js';
import { nlp } from './utils/nlp.js';

exports.handler = async function(event, context) {
    try {
        const requestBody = JSON.parse(event.body);
        console.log('requestBody= ', requestBody);
        const utterance = requestBody.utterance;
        const intent = nlp(utterance).intent;
        const engagementId = requestBody.engagement_id;
        const messageId = requestBody.message_id;

        const bearer = await createBearerToken(env.GLIA_KEY_ID, env.GLIA_KEY_SECRET);
        const engagement = await fetchEngagement(bearer, engagementId);
        console.log('engagement= ', engagement);
        const visitor = await fetchVisitor(bearer, engagement.visitor_id);
        console.log('visitor= ', visitor);

        const setCustomAttributes = visitorData => {
            if (visitorData.custom_attributes[engagementId] == undefined) {
                console.log('engagement start / first utterance received');
                const firstUtteranceData = {
                    '1': {
                        utterance: utterance,
                        intent: intent,
                        messageId: messageId,
                    },
                    utteranceHistory: utterance,
                    intentHistory: intent
                };
                return {
                    custom_attributes: {
                        [engagementId]: JSON.stringify(firstUtteranceData),
                    }
                };
            }
            else {
                console.log('engagement ongoing / new utterance received');
                const existingUtteranceData = JSON.parse(visitorData.custom_attributes[engagementId]) || {};
                console.log('existingUtteranceData= ', existingUtteranceData);
                const utteranceLength = Object.keys(existingUtteranceData).length || 0;
                console.log('utteranceLength= ', utteranceLength);
                console.log('existingHistory= ', existingUtteranceData.history, 'typeof existingHistory= ', typeof(existingUtteranceData.history));
                const newHistory = existingUtteranceData.utteranceHistory + utterance;
                const newIntentHistory = existingUtteranceData.intentHistory + intent;
                const newUtteranceData = {
                    ...existingUtteranceData,
                    [utteranceLength]: {
                        utterance: utterance,
                        intent: intent,
                        messageId: messageId,
                    },
                    utteranceHistory: newHistory,
                    intentHistory: newIntentHistory
                };
                console.log('newUtteranceData= ', newUtteranceData);
                return {
                    custom_attributes: {
                        [engagementId]: JSON.stringify(newUtteranceData)
                    }
                };
            }
        };
        const customAttributesResult = setCustomAttributes(visitor);
        console.log('customAttributesResult= ', customAttributesResult);

        const updatedVisitor = await updateVisitor(bearer, visitor.id, env.GLIA_SITE_ID, customAttributesResult);
        console.log('updatedVisitor= ', updatedVisitor);
        const intentState = JSON.parse(customAttributesResult.custom_attributes[engagementId.toString()]).intentHistory;
        console.log('intentState= ', intentState);

        // TODO: filter for numbers
        // update to array when updating switch-case to map
        // const ivrMap = {
        //     [1]: queueWaitWidget(bearer),
        // }
        // return ivrMap[intentState]
        // ["service", "callback", "now"]
        // ["sales", "callback", "afternoon"]
        switch (intentState) {
            case "claims":
                const response = claimsWidget("thank you for filing a claim")
                console.log(response)
                return response;
            case '1':
                return queueWaitWidget(bearer);
            case '2':
                await callbackWidget(bearer, engagementId, visitor);
                break
            case '3':
                await smsWidget(bearer, engagementId, visitor);
                break
            case '11':
                return transferWidget(env.GLIA_TRANSFER_QUEUE_ID);
            case '12':
                await callbackWidget(bearer, engagementId, visitor);
                break
            case '9':
                console.log('invoking transferWidget');
                return transferWidget(env.GLIA_TRANSFER_QUEUE_ID, visitor)
            default:
                await transferWidget(env.GLIA_TRANSFER_QUEUE_ID)
        }
    } catch(error) {
        console.log(error)
        var body = error.stack || JSON.stringify(error, null, 2);
        return {
            statusCode: 400,
            headers: {},
            body: JSON.stringify(body)
      }
    }
  }