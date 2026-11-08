CREATE TABLE usuarios_novos (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK (perfil IN ('administrador', 'editor', 'cliente')),
    ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO usuarios_novos SELECT * FROM usuarios;

CREATE TABLE sessoes_novas (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios_novos(id),
    csrf TEXT NOT NULL,
    expira_em INTEGER NOT NULL
);
INSERT INTO sessoes_novas SELECT * FROM sessoes;
CREATE TABLE recuperacoes_novas (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios_novos(id),
    expira_em INTEGER NOT NULL
);
INSERT INTO recuperacoes_novas SELECT * FROM recuperacoes;
CREATE TABLE historico_novo (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios_novos(id),
    autor TEXT NOT NULL,
    acao TEXT NOT NULL,
    entidade TEXT NOT NULL,
    registro TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO historico_novo SELECT * FROM historico;

DROP TABLE sessoes;
DROP TABLE recuperacoes;
DROP TABLE historico;
DROP TABLE usuarios;
ALTER TABLE usuarios_novos RENAME TO usuarios;
ALTER TABLE sessoes_novas RENAME TO sessoes;
ALTER TABLE recuperacoes_novas RENAME TO recuperacoes;
ALTER TABLE historico_novo RENAME TO historico;
CREATE INDEX sessoes_usuario ON sessoes(usuario_id);
CREATE INDEX recuperacoes_usuario ON recuperacoes(usuario_id);
