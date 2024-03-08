const buildSuggestion = messageContent => {
    return {
        type: "suggestion",
        content: messageContent
    };
};

const transferToQueue = (media, queueId, notifications) => {
    return {'type': 'transfer', 'properties': {'version': '0', 'media': media, 'queue_id': queueId, 'notifications': notifications}};
};

const buildResponseBody = (messages) => {
    if (Array.isArray(messages)) {
        return {'confidence_level': 0.99, 'messages': messages};
    }
    else {
        return {'confidence_level': 0.99, 'messages': [messages]};
    }
};

export {
    buildSuggestion, 
    buildResponseBody,
    transferToQueue
};