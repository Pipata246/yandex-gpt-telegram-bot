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

-- Создание таблицы для хранения истории сообщений
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  role TEXT NOT NULL, -- 'user' или 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Индекс для быстрого получения истории пользователя
CREATE INDEX IF NOT EXISTS idx_messages_telegram_id ON messages(telegram_id, created_at DESC);

-- Функция для автоматической очистки старых сообщений (оставляем последние 20)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM messages
  WHERE telegram_id = NEW.telegram_id
  AND id NOT IN (
    SELECT id FROM messages
    WHERE telegram_id = NEW.telegram_id
    ORDER BY created_at DESC
    LIMIT 20
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматической очистки
DROP TRIGGER IF EXISTS trigger_cleanup_messages ON messages;
CREATE TRIGGER trigger_cleanup_messages
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_messages();
