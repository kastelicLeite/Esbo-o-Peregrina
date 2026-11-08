CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    preco INTEGER NOT NULL DEFAULT 0,
    descricao TEXT NOT NULL
);

CREATE TABLE categorias (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    posicao INTEGER NOT NULL DEFAULT 0,
    ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1))
);

CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK (perfil IN ('administrador', 'editor')),
    ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessoes (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    csrf TEXT NOT NULL,
    expira_em INTEGER NOT NULL
);

CREATE TABLE recuperacoes (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    expira_em INTEGER NOT NULL
);

CREATE TABLE midias (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    arquivo TEXT NOT NULL UNIQUE,
    miniatura TEXT NOT NULL,
    alternativo TEXT NOT NULL DEFAULT '',
    pasta TEXT NOT NULL DEFAULT '',
    largura INTEGER NOT NULL,
    altura INTEGER NOT NULL,
    bytes INTEGER NOT NULL,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE configuracoes (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    dados TEXT NOT NULL,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conteudos (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    rascunho TEXT NOT NULL,
    publicado TEXT NOT NULL,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE historico (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    autor TEXT NOT NULL,
    acao TEXT NOT NULL,
    entidade TEXT NOT NULL,
    registro TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
