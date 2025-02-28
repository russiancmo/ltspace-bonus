const { Bot } = require('grammy');
const { ChatMistralAI } = require('@langchain/mistralai');
const { AgentExecutor, createToolCallingAgent } = require('langchain/agents');
const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const { DuckDuckGoSearch } = require('@langchain/community/tools/duckduckgo_search');
const { BufferMemory } = require('langchain/memory');
const { trimMessages } = require("@langchain/core/messages");
const dotenv = require('dotenv');
dotenv.config();

function formatAgentOutput(output) {
  if (typeof output === 'string') {
    return output;
  }
  if (Array.isArray(output)) {
    // Объединяем все объекты с типом "text"
    return output
      .map(segment => {
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
}

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const mistral = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: 'mistral-large-2411',
  streaming: false
});

const tools = [new DuckDuckGoSearch({ maxResults: 5 })];

// Объект для хранения памяти пользователей
const userMemoryMap = {};

const startBot = async () => {
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

  // Обработчик команды /start
  bot.command('start', async (ctx) => {
    await ctx.reply('Привет! Я могу помочь вам!');
  });

  // Обработчик команды /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Доступные команды:\n' +
        '/start - Начать работу с ботом\n' +
        '/help - Показать это сообщение\n\n'
    );
  });

  // Обработчик текстовых сообщений
  bot.on('message:text', async (ctx) => {
    try {
      const userMessage = ctx.message.text;
      const tg_id = ctx.chat.id;
      console.log('Получено сообщение:', userMessage);

      // Если для пользователя еще нет экземпляра памяти, создаем новый
      if (!userMemoryMap[tg_id]) {
        userMemoryMap[tg_id] = new BufferMemory({
          memoryKey: 'chat_history',
          inputKey: 'input',
          outputKey: 'output',
          humanPrefix: 'User',
          aiPrefix: 'Assistant',
        });
      }

      // Интегрируем память пользователя с агентом
      const userAgent = new AgentExecutor({
        tools,
        agent,
        agentType: 'structured-chat-zero-shot-react-description',
        verbose: true,
        memory: userMemoryMap[tg_id],
      });

      // Отправляем индикатор набора текста
      await ctx.replyWithChatAction('typing');

      // Используем агента для обработки запроса
      const result = await userAgent.invoke({ input: userMessage });

      // Отправляем ответ пользователю
      await ctx.reply(formatAgentOutput(result.output));
    } catch (error) {
      console.error('Ошибка при обработке сообщения:', error);
      await ctx.reply('Извините, произошла ошибка при обработке вашего запроса.');
    }
  });

  // Обработка ошибок
  bot.catch((err) => {
    console.error('Ошибка бота:', err);
  });

  // Запуск бота
  bot.start();
};

startBot();
