import { Bot } from 'grammy';
import * as dotenv from 'dotenv';
import { runUserAgent, transcribeVoice } from './bot.service.js';
dotenv.config();

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const startBot = async () => {
  // Обработчик команды /start
  bot.command('start', async (ctx) => {
    await ctx.reply('Привет! Я могу помочь вам!');
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

  bot.on('message:voice', async (ctx) => {
    try {
      const tg_id = ctx.chat.id;
      const voice = ctx.message.voice;
      const file_id = voice.file_id;
      const file = await ctx.api.getFile(file_id);
      const file_path = file.file_path;
      const audio_url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file_path}`;
      const response = await fetch(audio_url);
      const buffer = await response.arrayBuffer();
      const userTextMessage = await transcribeVoice(buffer);
      const result = await runUserAgent(userTextMessage, tg_id);
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
