import request from '../https/request.js';
import { v4 } from 'uuid';

// :: (str, str, str) -> {}
const sendMessageToGlia = async (bearer, engagementId, message) => {
    try{
        const msgId = v4();
        console.log('message ID is: ', msgId);
        const url = `https://api.salemove.com/engagements/${engagementId}/chat_messages/${msgId}`;
        const data = {
            type: 'chat',
            content: message
        };
        const options = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.salemove.v1+json',
                'Authorization': `Bearer ${bearer}`
            },
            timeout: 10000, // in ms
        }
        const response = await request(url, options, data);
        console.log('response from send chat message is: ', response);
    } catch(error){
        console.log(error)
    }
};

export default sendMessageToGlia