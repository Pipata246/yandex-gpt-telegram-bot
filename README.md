# Telegram Bot с Yandex GPT

AI-помощник на базе Yandex GPT с интеграцией Supabase для учета пользователей.

## Возможности

- 📝 Текстовый помощник на базе Yandex GPT
- ℹ️ Информация о боте и контакты поддержки
- 🚫 Отключение рекламы (в разработке)
- 📊 Учет пользователей через Supabase

## Установка

1. Клонируйте репозиторий:
```bash
git clone <your-repo-url>
cd <repo-name>
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

4. Заполните переменные окружения в `.env`:
   - `TELEGRAM_BOT_TOKEN` - токен от @BotFather
   - `YANDEX_API_KEY` - API ключ Yandex Cloud
   - `YANDEX_FOLDER_ID` - ID папки в Yandex Cloud
   - `SUPABASE_URL` - URL вашего проекта Supabase
   - `SUPABASE_KEY` - Anon key из Supabase

## Настройка Supabase

Создайте таблицу `users` в Supabase:

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  last_active TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_telegram_id ON users(telegram_id);
```

## Получение Yandex API ключа

1. Зарегистрируйтесь в [Yandex Cloud](https://cloud.yandex.ru/)
2. Создайте сервисный аккаунт
3. Назначьте роль `ai.languageModels.user`
4. Создайте API ключ
5. Скопируйте Folder ID из консоли

## Запуск локально

```bash
npm start
```

## Деплой на Vercel

1. Установите Vercel CLI:
```bash
npm i -g vercel
```

2. Залогиньтесь:
```bash
vercel login
```

3. Задеплойте проект:
```bash
vercel
```

4. Добавьте переменные окружения в настройках проекта на Vercel

## Поддержка

Контакт: @NerdIdk
