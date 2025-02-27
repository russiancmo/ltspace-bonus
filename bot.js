process.env.NODE_OPTIONS = '--openssl-legacy-provider';

const { Bot } = require('grammy');
const { ChatMistralAI } = require('@langchain/mistralai');
const { AgentExecutor, createToolCallingAgent } = require('langchain/agents');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const {
  GmailCreateDraft,
  GmailGetMessage,
  GmailGetThread,
  GmailSearch,
  GmailSendMessage,
} = require('@langchain/community/tools/gmail');
const dotenv = require('dotenv');
dotenv.config();

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const mistral = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: 'mistral-tiny',
});

const gmailParams = {
  credentials: {
    keyfile: './keyfile.json',
  },
  scopes: ['https://mail.google.com/'],
};

const tools = [
  new GmailCreateDraft(gmailParams),
  new GmailGetMessage(gmailParams),
  new GmailGetThread(gmailParams),
  new GmailSearch(gmailParams),
  new GmailSendMessage(gmailParams),
];

const startBot = async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'Ты менеджер по продажам. Ты можешь отвечать на вопросы клиента только на основе информации из инструмента поиска. ' +
        'Если информации недостаточно, честно скажи, что не можешь ответить. Не выдумывай и не делай предположений. ' +
        'Если клиент хочет оформить заказ, используй инструмент оформления заказа.',
    ],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  const agent = createToolCallingAgent({
    llm: mistral,
    tools,
    prompt,
  });

  const gmailAgent = new AgentExecutor({
    tools,
    agent,
    agentType: 'structured-chat-zero-shot-react-description',
    verbose: true,
  });

  // Обработчик команды /start
  bot.command('start', async (ctx) => {
    await ctx.reply(
      'Привет! Я могу помочь вам с поиском и анализом писем в Gmail. Напишите ваш запрос.'
    );
  });

  // Обработчик команды /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Доступные команды:\n' +
        '/start - Начать работу с ботом\n' +
        '/help - Показать это сообщение\n\n' +
        'Примеры запросов:\n' +
        '- Найди письма за последнюю неделю\n' +
        '- Поищи письма от example@gmail.com\n' +
        '- Проанализируй последнюю переписку с клиентом'
    );
  });

  // Обработчик текстовых сообщений
  bot.on('message:text', async (ctx) => {
    try {
      const userMessage = ctx.message.text;
      console.log('Получено сообщение:', userMessage);

      // Отправляем индикатор набора текста
      await ctx.replyWithChatAction('typing');

      // Используем агента для обработки запроса
      const result = await gmailAgent.invoke({
        input: userMessage,
      });

      // Отправляем ответ пользователю
      await ctx.reply(result.output);
    } catch (error) {
      console.error('Ошибка при обработке сообщения:', error);
      await ctx.reply(
        'Извините, произошла ошибка при обработке вашего запроса.'
      );
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
