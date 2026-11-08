CREATE TABLE senha_painel (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    senha_hash TEXT NOT NULL
);

CREATE TABLE acessos_painel (
    token_hash TEXT PRIMARY KEY REFERENCES sessoes(token_hash) ON DELETE CASCADE,
    expira_em INTEGER NOT NULL
);
