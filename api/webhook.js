import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Хранилище режимов пользователей (в памяти)
const userModes = new Map();

// Главное меню с кнопками
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['\uD83D\uDCDD Текстовый помощник', '\u2139\uFE0F Информация'],
      ['\uD83C\uDFA8 Генерация изображений', '\uD83D\uDDD1\uFE0F Очистить историю']
    ],
    resize_keyboard: true
  }
};

// Регистрация пользователя в Supabase
async function registerUser(userId, username, firstName, lastName) {
  try {
    const { error } = await supabase
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

// Получение истории сообщений пользователя
async function getMessageHistory(userId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('role, content')
      .eq('telegram_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error getting message history:', error);
      return [];
    }
    
    // Возвращаем в правильном порядке (от старых к новым)
    return data ? data.reverse() : [];
  } catch (err) {
    console.error('Error getting message history:', err);
    return [];
  }
}

// Сохранение сообщения в историю
async function saveMessage(userId, role, content) {
  try {
    await supabase
      .from('messages')
      .insert({
        telegram_id: userId,
        role: role,
        content: content
      });
  } catch (err) {
    console.error('Error saving message:', err);
  }
}

// Очистка истории сообщений пользователя
async function clearMessageHistory(userId) {
  try {
    await supabase
      .from('messages')
      .delete()
      .eq('telegram_id', userId);
  } catch (err) {
    console.error('Error clearing message history:', err);
  }
}

// Генерация изображения через Pollinations AI
async function generateImage(prompt) {
  try {
    // Pollinations AI - бесплатный API для генерации изображений
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
    
    return imageUrl;
  } catch (error) {
    console.error('Image generation error:', error);
    return null;
  }
}

// Транскрибация голосового сообщения через Groq Whisper
async function transcribeVoice(fileUrl) {
  try {
    // Скачиваем аудио файл
    const audioResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const audioBuffer = Buffer.from(audioResponse.data);
    
    // Отправляем в Groq Whisper API
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'ru');
    
    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        }
      }
    );
    
    return response.data.text;
  } catch (error) {
    console.error('Voice transcription error:', error.response?.data || error.message);
    return null;
  }
}

// Запрос к Groq AI с историей сообщений
async function askGroqAI(userId, question) {
  try {
    // Получаем историю последних 10 сообщений
    const history = await getMessageHistory(userId, 10);
    
    // Формируем массив сообщений для API
    const messages = [
      {
        role: 'system',
        content: 'Ты полезный AI-помощник. Отвечай кратко и по делу на русском языке. Ты помнишь предыдущие сообщения в разговоре.'
      }
    ];
    
    // Добавляем историю
    history.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });
    
    // Добавляем текущий вопрос
    messages.push({
      role: 'user',
      content: question
    });

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: messages,
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

    const answer = response.data.choices[0].message.content;
    
    // Сохраняем вопрос и ответ в историю
    await saveMessage(userId, 'user', question);
    await saveMessage(userId, 'assistant', answer);
    
    return answer;
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
    userModes.delete(userId); // Сбрасываем режим при старте
    
    await bot.sendMessage(
      chatId,
      '\uD83D\uDC4B Добро пожаловать! Я AI-помощник на базе Groq AI.\n\n' +
      '\u26A0\uFE0F Выберите режим работы из меню ниже:',
      mainMenu
    );
    return;
  }

  await updateUserActivity(userId);

  if (text === '\uD83D\uDCDD Текстовый помощник') {
    userModes.set(userId, 'text');
    await bot.sendMessage(
      chatId,
      '\u2705 Режим текстового помощника активирован!\n\n' +
      '\uD83D\uDCAC Теперь задайте мне любой вопрос, и я постараюсь на него ответить.\n\n' +
      '\uD83D\uDCA1 Я помню контекст разговора, поэтому можете задавать уточняющие вопросы.',
      mainMenu
    );
  } else if (text === '\u2139\uFE0F Информация') {
    await bot.sendMessage(
      chatId,
      '\u2139\uFE0F *Информация о боте*\n\n' +
      '\uD83E\uDD16 Я AI-помощник на базе Groq AI (Llama 3.3)\n' +
      '\uD83D\uDCDD Могу отвечать на ваши вопросы\n' +
      '\uD83C\uDFA8 Генерирую изображения\n' +
      '\uD83C\uDFA4 Понимаю голосовые сообщения\n' +
      '\uD83D\uDCA1 Помогаю с различными задачами\n\n' +
      '\uD83D\uDCDE *Поддержка:* @NerdIdk',
      { parse_mode: 'Markdown', ...mainMenu }
    );
  } else if (text === '\uD83C\uDFA8 Генерация изображений') {
    userModes.set(userId, 'image');
    await bot.sendMessage(
      chatId,
      '\u2705 Режим генерации изображений активирован!\n\n' +
      '\uD83C\uDFA8 Теперь опишите, какое изображение вы хотите создать.\n\n' +
      'Примеры:\n' +
      '\u2022 "Кот в космосе"\n' +
      '\u2022 "Закат на море"\n' +
      '\u2022 "Футуристический город"\n\n' +
      '\uD83D\uDCA1 Каждое ваше сообщение будет генерировать новую картинку.\n' +
      '\uD83D\uDCDD Для выхода нажмите "\uD83D\uDCDD Текстовый помощник"',
      { parse_mode: 'Markdown', ...mainMenu }
    );
  } else if (text === '\uD83D\uDDD1\uFE0F Очистить историю') {
    await clearMessageHistory(userId);
    const currentMode = userModes.get(userId);
    const modeText = currentMode === 'text' ? '\uD83D\uDCDD Текстовый помощник' : 
                     currentMode === 'image' ? '\uD83C\uDFA8 Генерация изображений' : null;
    
    await bot.sendMessage(
      chatId,
      '\u2705 История сообщений очищена!\n\n' +
      'Теперь я начну новый разговор с чистого листа.\n\n' +
      (modeText ? `Текущий режим: ${modeText}` : '\u26A0\uFE0F Выберите режим работы'),
      mainMenu
    );
  } else {
    // Проверяем режим пользователя
    const mode = userModes.get(userId);
    
    if (!mode) {
      // Режим не выбран
      await bot.sendMessage(
        chatId,
        '\u26A0\uFE0F Пожалуйста, выберите режим работы из меню ниже:\n\n' +
        '\uD83D\uDCDD Текстовый помощник - для вопросов и ответов\n' +
        '\uD83C\uDFA8 Генерация изображений - для создания картинок',
        mainMenu
      );
    } else if (mode === 'image') {
      // Режим генерации изображений
      await bot.sendMessage(chatId, '\uD83C\uDFA8 Генерирую изображение...');
      
      const imageUrl = await generateImage(text);
      if (imageUrl) {
        await bot.sendPhoto(chatId, imageUrl, { 
          caption: `\uD83C\uDFA8 "${text}"`,
          ...mainMenu 
        });
      } else {
        await bot.sendMessage(chatId, '\u274C Ошибка при генерации изображения. Попробуйте еще раз.', mainMenu);
      }
    } else if (mode === 'text') {
      // Режим текстового помощника
      await bot.sendMessage(chatId, '\u23F3 Обрабатываю ваш запрос...');
      
      const answer = await askGroqAI(userId, text);
      await bot.sendMessage(chatId, answer, mainMenu);
    }
  }
}

// Обработка голосовых сообщений
async function handleVoice(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const voice = msg.voice;
  
  try {
    await updateUserActivity(userId);
    
    // Проверяем режим пользователя
    const mode = userModes.get(userId);
    
    if (!mode) {
      // Режим не выбран
      await bot.sendMessage(
        chatId,
        '\u26A0\uFE0F Пожалуйста, сначала выберите режим работы из меню ниже:\n\n' +
        '\uD83D\uDCDD Текстовый помощник - для вопросов и ответов\n' +
        '\uD83C\uDFA8 Генерация изображений - для создания картинок',
        mainMenu
      );
      return;
    }
    
    await bot.sendMessage(chatId, '\uD83C\uDFA4 Обрабатываю голосовое сообщение...');
    
    // Получаем ссылку на файл
    const fileInfo = await bot.getFile(voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
    
    // Транскрибируем голос
    const transcription = await transcribeVoice(fileUrl);
    
    if (transcription) {
      await bot.sendMessage(chatId, `\uD83D\uDCDD Вы сказали: "${transcription}"`);
      
      if (mode === 'image') {
        // Режим генерации изображений
        await bot.sendMessage(chatId, '\uD83C\uDFA8 Генерирую изображение...');
        
        const imageUrl = await generateImage(transcription);
        if (imageUrl) {
          await bot.sendPhoto(chatId, imageUrl, { 
            caption: `\uD83C\uDFA8 "${transcription}"`,
            ...mainMenu 
          });
        } else {
          await bot.sendMessage(chatId, '\u274C Ошибка при генерации изображения. Попробуйте еще раз.', mainMenu);
        }
      } else if (mode === 'text') {
        // Режим текстового помощника
        await bot.sendMessage(chatId, '\u23F3 Обрабатываю ваш запрос...');
        
        const answer = await askGroqAI(userId, transcription);
        await bot.sendMessage(chatId, answer, mainMenu);
      }
    } else {
      await bot.sendMessage(chatId, '\u274C Не удалось распознать голосовое сообщение. Попробуйте еще раз.', mainMenu);
    }
  } catch (error) {
    console.error('Voice handling error:', error);
    await bot.sendMessage(chatId, '\u274C Ошибка при обработке голосового сообщения.', mainMenu);
  }
}

// Webhook handler для Vercel
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { body } = req;
      
      if (body.message) {
        // Проверяем тип сообщения
        if (body.message.voice) {
          await handleVoice(body.message);
        } else if (body.message.text) {
          await handleMessage(body.message);
        }
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
