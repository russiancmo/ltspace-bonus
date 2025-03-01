import { Bot } from 'grammy';
import * as dotenv from 'dotenv';
import { runUserAgent } from './bot.service.js';
dotenv.config();

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const startBot = async () => {
  // Обработчик команды /start
  bot.command('start', async (ctx) => {
    const tg_id = ctx.chat.id;
    const result = await runUserAgent('Привет', tg_id);
    await ctx.reply(result);
  });

  // Обработчик команды /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Доступные команды:\n' + '/start - Начать работу с ботом\n' + '/help - Показать это сообщение\n\n'
    );
  });

  // Обработчик текстовых сообщений
  bot.on('message:text', async (ctx) => {
    try {
      const userMessage = ctx.message.text;
      const tg_id = ctx.chat.id;
      await ctx.replyWithChatAction('typing');
      const result = await runUserAgent(userMessage, tg_id);
      await ctx.reply(result);
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
