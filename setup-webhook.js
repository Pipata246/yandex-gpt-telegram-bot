// Скрипт для установки webhook
// Запустите: node setup-webhook.js https://ваш-домен.vercel.app/api/webhook

import axios from 'axios';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8479643300:AAEZR5L0wh4zdPoo2dyiFLv_5tTiRSmfGiw';
const WEBHOOK_URL = process.argv[2];

if (!WEBHOOK_URL) {
  console.error('❌ Укажите URL webhook: node setup-webhook.js https://ваш-домен.vercel.app/api/webhook');
  process.exit(1);
}

async function setWebhook() {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      { url: WEBHOOK_URL }
    );
    
    if (response.data.ok) {
      console.log('✅ Webhook установлен успешно!');
      console.log('URL:', WEBHOOK_URL);
    } else {
      console.error('❌ Ошибка:', response.data);
    }
  } catch (error) {
    console.error('❌ Ошибка при установке webhook:', error.message);
  }
}

setWebhook();
