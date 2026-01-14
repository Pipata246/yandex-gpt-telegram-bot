import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Главное меню с кнопками
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📝 Текстовый помощник', 'ℹ️ Информация'],
      ['🚫 Отключить рекламу']
    ],
    resize_keyboard: true
  }
};

// Регистрация пользователя в Supabase
async function registerUser(userId, username, firstName, lastName) {
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        telegram_id: userId,
        username: username,
        first_name: firstName,
        last_name: lastName,
        last_active: new Date().toISOString()
      }, {
        onConflict: 'telegram_id'
      });
    
    if (error) console.error('Supabase error:', error);
  } catch (err) {
    console.error('Error registering user:', err);
  }
}

// Обновление активности пользователя
async function updateUserActivity(userId) {
  try {
    await supabase
      .from('users')
      .update({ last_active: new Date().toISOString() })
      .eq('telegram_id', userId);
  } catch (err) {
    console.error('Error updating user activity:', err);
  }
}

// Запрос к Yandex GPT
async function askYandexGPT(question) {
  try {
    const response = await axios.post(
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
      {
        modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt-lite`,
        completionOptions: {
          stream: false,
          temperature: 0.6,
          maxTokens: 2000
        },
        messages: [
          {
            role: 'system',
            text: 'Ты полезный AI-помощник. Отвечай кратко и по делу.'
          },
          {
            role: 'user',
            text: question
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${process.env.YANDEX_API_KEY}`
        }
      }
    );

    return response.data.result.alternatives[0].message.text;
  } catch (error) {
    console.error('Yandex GPT error:', error.response?.data || error.message);
    return 'Извините, произошла ошибка при обработке запроса. Попробуйте позже.';
  }
}

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  await registerUser(user.id, user.username, user.first_name, user.last_name);
  
  bot.sendMessage(
    chatId,
    '👋 Добро пожаловать! Я AI-помощник на базе Yandex GPT.\n\n' +
    'Выберите действие из меню ниже:',
    mainMenu
  );
});

// Обработка кнопок меню
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;

  if (text === '/start') return;

  await updateUserActivity(userId);

  if (text === '📝 Текстовый помощник') {
    bot.sendMessage(
      chatId,
      '💬 Режим текстового помощника активирован!\n\n' +
      'Задайте мне любой вопрос, и я постараюсь на него ответить.',
      mainMenu
    );
  } else if (text === 'ℹ️ Информация') {
    bot.sendMessage(
      chatId,
      'ℹ️ *Информация о боте*\n\n' +
      '🤖 Я AI-помощник на базе Yandex GPT\n' +
      '📝 Могу отвечать на ваши вопросы\n' +
      '💡 Помогаю с различными задачами\n\n' +
      '📞 *Поддержка:* @NerdIdk',
      { parse_mode: 'Markdown', ...mainMenu }
    );
  } else if (text === '🚫 Отключить рекламу') {
    bot.sendMessage(
      chatId,
      '🚧 Эта функция находится в разработке.\n\n' +
      'Скоро здесь появится возможность отключить рекламу!',
      mainMenu
    );
  } else {
    // Обработка обычных текстовых сообщений как вопросов к GPT
    bot.sendMessage(chatId, '⏳ Обрабатываю ваш запрос...');
    
    const answer = await askYandexGPT(text);
    bot.sendMessage(chatId, answer, mainMenu);
  }
});

console.log('🤖 Бот запущен!');
