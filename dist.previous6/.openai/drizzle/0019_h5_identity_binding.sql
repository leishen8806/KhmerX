ALTER TABLE h5_accounts ADD COLUMN phone_key TEXT;
ALTER TABLE h5_accounts ADD COLUMN telegram_user_hash TEXT;
ALTER TABLE h5_accounts ADD COLUMN telegram_verified INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS h5_accounts_owner_phone_key_unique ON h5_accounts(owner, phone_key);
CREATE UNIQUE INDEX IF NOT EXISTS h5_accounts_owner_telegram_hash_unique ON h5_accounts(owner, telegram_user_hash);
UPDATE h5_accounts SET phone_key=customer_id WHERE phone_key IS NULL;
