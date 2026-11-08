CREATE TABLE acessos_tabelas (
    token_hash TEXT PRIMARY KEY REFERENCES sessoes(token_hash) ON DELETE CASCADE,
    expira_em INTEGER NOT NULL
);
