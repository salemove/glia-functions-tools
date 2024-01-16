
const transferWidget = async (queueId, media, successNotification, failureNotification, alreadyOngoingNotification, declinedNotification, timedOutNotification ) => {
    console.log('invoking transfer to queue');
    const transferResponse = {'messages':[{'type':'transfer','properties':{'version':'0','media':media,'queue_id':queueId,'notifications': {'success': successNotification, 'failure': failureNotification,'transfer_already_ongoing': alreadyOngoingNotification,'declined':declinedNotification,'timed_out': timedOutNotification}}}],'confidence_level':0.99}
    console.log('response to Glia: ', JSON.stringify(transferResponse))
    return new Response(JSON.stringify(transferResponse))
}

export default transferWidget;