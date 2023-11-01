import chatCompletion from './openai/chatCompletion.js'

const result = await chatCompletion('how do you calculate the valuation of a SaaS company in the customer communications space?');
console.log(result.choices[0].message.content)