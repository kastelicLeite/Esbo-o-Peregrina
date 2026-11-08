ALTER TABLE variacoes ADD COLUMN unitario_centavos INTEGER CHECK (unitario_centavos IS NULL OR unitario_centavos > 0);
