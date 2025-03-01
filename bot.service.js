import * as dotenv  from 'dotenv';
import { ChatMistralAI } from '@langchain/mistralai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';
import { BufferMemory } from 'langchain/memory';
dotenv.config();

class TrimmedBufferMemory extends BufferMemory {
  async loadMemoryVariables(args) {
    let memoryVars = await super.loadMemoryVariables(args);
    const maxMessages = 20;
    if (memoryVars.chat_history.length > maxMessages) {
      const messages = memoryVars.chat_history.slice(-maxMessages);
      await this.clear();
      for (let i = 0; i < messages.length; i += 2) {
        const humanMessage = messages[i]?.content || '';
        const aiMessage = messages[i + 1]?.content || '';
        await this.saveContext({ input: humanMessage }, { output: aiMessage });
      }
      memoryVars.chat_history = messages;
    }
    return memoryVars;
  }
}

const formatAgentOutput = (output) => {
  if (typeof output === 'string') {
    return output;
  }
  if (Array.isArray(output)) {
    // Объединяем все объекты с типом "text"
    return output
      .map((segment) => {
        // Если это текстовый сегмент, возвращаем текст
        if (segment.type === 'text' && typeof segment.text === 'string') {
          return segment.text;
        }
        // Для других типов можно настроить обработку, например, пропустить их
        return '';
      })
      .join('');
  }
  return String(output);
};

const mistral = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: 'mistral-large-2411',
  streaming: false,
});

const tools = [new DuckDuckGoSearch({ maxResults: 5 })];

// Объект для хранения памяти пользователей
const userMemoryMap = {};

export const runUserAgent = async (userMessage, tg_id) => {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'Ты личный помощник. У тебя есть возможность искать информацию в интернете. ' +
        'Подумай перед тем как ответить на вопрос. Также при использовании информации из DuckDuckGoSearch. ' +
        'Давай только обдуманные ответы',
    ],
    ['placeholder', '{chat_history}'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  const agent = createToolCallingAgent({
    llm: mistral,
    tools,
    prompt,
  });

  if (!userMemoryMap[tg_id]) {
    userMemoryMap[tg_id] = new TrimmedBufferMemory({
      memoryKey: 'chat_history',
      inputKey: 'input',
      outputKey: 'output',
      humanPrefix: 'User',
      aiPrefix: 'Assistant',
      returnMessages: true,
    });
  }

  const userAgent = new AgentExecutor({
    tools,
    agent,
    agentType: 'structured-chat-zero-shot-react-description',
    verbose: true,
    memory: userMemoryMap[tg_id],
  });

  const result = await userAgent.invoke({ input: userMessage });

  return formatAgentOutput(result.output)
};
