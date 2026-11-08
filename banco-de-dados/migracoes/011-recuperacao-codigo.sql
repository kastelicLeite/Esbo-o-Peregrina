CREATE TABLE recuperacoes_codigos (
    desafio_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_hash TEXT NOT NULL,
    senha_versao TEXT NOT NULL,
    criado_em INTEGER NOT NULL,
    expira_em INTEGER NOT NULL,
    tentativas INTEGER NOT NULL DEFAULT 0,
    permissao_hash TEXT UNIQUE
);
