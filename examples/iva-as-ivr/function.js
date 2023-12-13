import queueWaitWidget from './queueWaitWidget.js';
import callbackWidget from './callbackWidget.js';
import transferWidget from './transferWidget.js';
import smsWidget from './smsWidget.js';
import createBearerToken from './promises/createBearerToken.js';
import fetchEngagement from './promises/fetchEngagement.js';
import fetchVisitor from './promises/fetchVisitor.js';
import updateVisitor from './promises/updateVisitor.js';
import { onlyDigits } from './utils/helpers.js';
import { returnSuggestionToVisitor } from './utils/gliaAi.js'
import redactEngagement from './promises/redactEngagement.js'

export async function onInvoke(request, env) {
    try {
        const requestJson = await request.json();
        const payload = JSON.parse(requestJson.payload);
        console.log('function invoked!!!!')
        console.log('requestJson= ', JSON.stringify(requestJson));
        console.log('utterance= ', payload.utterance)
        const utterance = onlyDigits(payload.utterance);
        const engagementId = payload.engagement_id;
        const messageId = payload.message_id;

        const bearer = await createBearerToken(env.GLIA_KEY_ID, env.GLIA_KEY_SECRET);
        // const engagement = await fetchEngagement(bearer, engagementId);
        // console.log('engagement= ', engagement);
        const visitor = await fetchVisitor(bearer, env.GLIA_TRANSFER_SITE_ID, payload.visitor_id);

        const setCustomAttributes = visitorData => {
            if (visitorData.custom_attributes[engagementId] == undefined) {
                console.log('engagement start / first utterance received');
                const firstUtteranceData = {
                    '1': {
                        utterance: utterance,
                        messageId: messageId,
                    },
                    history: utterance
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
                const newHistory = existingUtteranceData.history + utterance;
                const newUtteranceData = {
                    ...existingUtteranceData,
                    [utteranceLength]: {
                        utterance: utterance,
                        messageId: messageId,
                    },
                    history: newHistory
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

        await updateVisitor(bearer, visitor.id, env.GLIA_SITE_ID, customAttributesResult);

        // replace with a more sophisticated function that derives the next step  / reply
        const intentState = JSON.parse(customAttributesResult.custom_attributes[engagementId.toString()]).history;
        console.log('intentState= ', intentState);

        // update to array when updating switch-case to map
        // const ivrMap = {
        //     [1]: queueWaitWidget(bearer),
        // }
        // return ivrMap[intentState]
        // ["service", "callback", "now"]
        // ["sales", "callback", "afternoon"]

        // trying to replace hard coded responses with responses configured by user in Glia Hub
        // AI Engine Additional Payload key (input / intentState) - value pairs (AI command response)
        const response = payload.engine_settings[intentState]
        if (response) {
            console.log('response found in config - returning it')
            console.log('response returned to Glia= ', response)
            return new Response(response)
        }

        // hard coded responses
        switch (intentState) {
            case '1':
                return queueWaitWidget(bearer, env.GLIA_TRANSFER_SITE_ID, env.GLIA_TRANSFER_QUEUE_ID);
            case '2':
                return queueWaitWidget(bearer, env.GLIA_TRANSFER_SITE_ID, env.GLIA_TRANSFER_QUEUE_ID);
            case '3':
                return smsWidget(bearer, engagementId, visitor);
            case '4':
                return queueWaitWidget(bearer, env.GLIA_TRANSFER_SITE_ID, env.GLIA_TRANSFER_QUEUE_ID);
            case '44':
                // redact engagement data
                // this does not work for an ongoing engagement
                const redactionRequestBody = {
                    site_id: env.GLIA_SITE_ID,
                    engagement_id: engagementId
                }
                await redactEngagement(bearer, redactionRequestBody)
                const redactedEngagementData = fetchEngagement(bearer, engagementId)
                console.log('redactedEngagement ', redactedEngagementData)
                return returnSuggestionToVisitor(JSON.stringify(redactedEngagementData))
            case '11':
                return transferWidget(env.GLIA_TRANSFER_QUEUE_ID, 'audio', 'Transferring you now', 'I am sorry but I cannot transfer you. Can I help you with anything else?', 'Hang on, I am transferring you to the queue', 'I am sorry but I cannot transfer you. Can I help you with anything else?', 'I am sorry but I cannot transfer you. Can I help you with anything else?');
            case '21':
                return transferWidget(env.GLIA_TRANSFER_QUEUE_ID, 'audio', 'Transferring you now', 'I am sorry but I cannot transfer you. Can I help you with anything else?', 'Hang on, I am transferring you to the queue', 'I am sorry but I cannot transfer you. Can I help you with anything else?', 'I am sorry but I cannot transfer you. Can I help you with anything else?');
            case '12':
                return callbackWidget(bearer, engagementId, visitor, env.GLIA_TRANSFER_SITE_ID, env.GLIA_TRANSFER_QUEUE_ID);
            case '9':
                console.log('trying to validate I can return a transfer')
                return new Response(JSON.stringify({'messages':[{'type':'transfer','properties':{'version':'0','media':'audio','queue_id':env.GLIA_TRANSFER_QUEUE_ID,'notifications': {'success': 'I am transferring you to John', 'failure': 'I can\'t transfer you to John at this time','transfer_already_ongoing': 'I am already transferring you to John','declined':'I am sorry, John is busy','timed_out': 'I am sorry, John seems to be away'}}}],'confidence_level':0.99}))
            default:
                return transferWidget(env.GLIA_TRANSFER_QUEUE_ID, 'audio', 'Transferring you now', 'I am sorry but I cannot transfer you. Can I help you with anything else?', 'Hang on, I am transferring you to the queue', 'I am sorry but I cannot transfer you. Can I help you with anything else?', 'I am sorry but I cannot transfer you. Can I help you with anything else?');
        }
    } catch(error) {
        console.log(error)
        return new Response(JSON.stringify(error))
    }
  }