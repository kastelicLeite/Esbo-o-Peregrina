CREATE UNIQUE INDEX usuarios_nome_unico ON usuarios(lower(trim(nome)));
