import OpenAI from "openai";

const chatCompletion = async (openAiKey, utterance) => {
    const openai = new OpenAI({
        apiKey: openAiKey || process.env.OPENAI_SECRET
    });
    const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: utterance }],
        model: 'gpt-3.5-turbo',
      });

      return chatCompletion
};

export default chatCompletion;
