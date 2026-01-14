-- Создание таблицы пользователей для Telegram бота
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  last_active TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по telegram_id
CREATE INDEX IF NOT EXISTS idx_telegram_id ON users(telegram_id);

-- Индекс для сортировки по активности
CREATE INDEX IF NOT EXISTS idx_last_active ON users(last_active DESC);
