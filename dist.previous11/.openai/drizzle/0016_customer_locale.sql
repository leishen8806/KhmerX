ALTER TABLE h5_accounts ADD COLUMN locale TEXT NOT NULL DEFAULT 'en';
CREATE INDEX IF NOT EXISTS h5_accounts_owner_locale ON h5_accounts(owner, locale);
