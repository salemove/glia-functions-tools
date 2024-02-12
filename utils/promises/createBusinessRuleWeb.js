import request from '../https/request.js';

const createBusinessRuleWeb = async (bearerToken, demoId, siteId, queueId, demoName) => {
    const url = `https://api.glia.com/sites/${siteId}/business_rules`;

    const options = {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.salemove.v1+json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`
        },
        timeout: 10000, // in ms
    };

    const data = {
        "name": demoName,
        "context": {
          "conditions": [],
          "site_id": siteId,
          "type": "visitor_navigation",
          "url": `^.*${demoName}$`
        },
        "actions": [
          {
            "frequency": {
              "type": "always"
            },
            "id": "a7facdcd-8df9-4038-84b2-ff5e3d64db14",
            "type": "set_queues_for_visitor",
            "queue_ids": [
              queueId
            ]
          }
        ],
        "context_conditions": [],
        "post_conditions": [],
        "sources": [
            {id: "56c86dc0-3814-46bc-835b-acabb000d39d", type: "time_on_page", seconds: 1}
        ],
        "id": demoId
      };
    const response = await request(url, options, data);
    return JSON.parse(response)
};

export default createBusinessRuleWeb;