ALTER TABLE variacoes ADD COLUMN aproximado INTEGER NOT NULL DEFAULT 0 CHECK (aproximado IN (0, 1));
