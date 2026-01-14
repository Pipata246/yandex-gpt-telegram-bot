import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
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

// Запрос к Groq AI
async function askGroqAI(question) {
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Ты полезный AI-помощник. Отвечай кратко и по делу на русском языке.'
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Groq AI error:', error.response?.data || error.message);
    return 'Извините, произошла ошибка при обработке запроса. Попробуйте позже.';
  }
}

// Обработка сообщений
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;

  if (text === '/start') {
    await registerUser(userId, msg.from.username, msg.from.first_name, msg.from.last_name);
    
    await bot.sendMessage(
      chatId,
      '👋 Добро пожаловать! Я AI-помощник на базе Groq AI.\n\n' +
      'Выберите действие из меню ниже:',
      mainMenu
    );
    return;
  }

  await updateUserActivity(userId);

  if (text === '📝 Текстовый помощник') {
    await bot.sendMessage(
      chatId,
      '💬 Режим текстового помощника активирован!\n\n' +
      'Задайте мне любой вопрос, и я постараюсь на него ответить.',
      mainMenu
    );
  } else if (text === 'ℹ️ Информация') {
    await bot.sendMessage(
      chatId,
      'ℹ️ *Информация о боте*\n\n' +
      '🤖 Я AI-помощник на базе Groq AI (Llama 3.3)\n' +
      '📝 Могу отвечать на ваши вопросы\n' +
      '💡 Помогаю с различными задачами\n\n' +
      '📞 *Поддержка:* @NerdIdk',
      { parse_mode: 'Markdown', ...mainMenu }
    );
  } else if (text === '🚫 Отключить рекламу') {
    await bot.sendMessage(
      chatId,
      '🚧 Эта функция находится в разработке.\n\n' +
      'Скоро здесь появится возможность отключить рекламу!',
      mainMenu
    );
  } else {
    await bot.sendMessage(chatId, '⏳ Обрабатываю ваш запрос...');
    
    const answer = await askGroqAI(text);
    await bot.sendMessage(chatId, answer, mainMenu);
  }
}

// Webhook handler для Vercel
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { body } = req;
      
      if (body.message) {
        await handleMessage(body.message);
      }
      
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error:', error);
      res.status(200).json({ ok: true });
    }
  } else {
    res.status(200).json({ status: 'Bot is running' });
  }
}
