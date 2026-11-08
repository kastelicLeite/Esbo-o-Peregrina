ALTER TABLE produtos ADD COLUMN slug TEXT;
ALTER TABLE produtos ADD COLUMN categoria_id INTEGER REFERENCES categorias(id);
ALTER TABLE produtos ADD COLUMN estado TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (estado IN ('rascunho', 'publicado', 'arquivado'));
ALTER TABLE produtos ADD COLUMN destaque INTEGER NOT NULL DEFAULT 0;
ALTER TABLE produtos ADD COLUMN posicao INTEGER NOT NULL DEFAULT 0;
ALTER TABLE produtos ADD COLUMN comercial TEXT NOT NULL DEFAULT 'orcamento'
    CHECK (comercial IN ('orcamento', 'preco'));
ALTER TABLE produtos ADD COLUMN imagem_id TEXT REFERENCES midias(id);
ALTER TABLE produtos ADD COLUMN galeria TEXT NOT NULL DEFAULT '[]';
ALTER TABLE produtos ADD COLUMN caracteristicas TEXT NOT NULL DEFAULT '[]';
ALTER TABLE produtos ADD COLUMN tiragens TEXT NOT NULL DEFAULT '[]';
ALTER TABLE produtos ADD COLUMN publicado_json TEXT;
ALTER TABLE produtos ADD COLUMN atualizado_em TEXT NOT NULL DEFAULT '';

UPDATE produtos SET slug = 'produto-' || id, atualizado_em = CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX produtos_slug ON produtos(slug);

CREATE TABLE variacoes (
    id INTEGER PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    opcoes TEXT NOT NULL,
    assinatura TEXT NOT NULL,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    total_centavos INTEGER CHECK (total_centavos IS NULL OR total_centavos > 0),
    codigo TEXT NOT NULL DEFAULT '',
    disponivel INTEGER NOT NULL DEFAULT 1,
    ativa INTEGER NOT NULL DEFAULT 1,
    UNIQUE (produto_id, assinatura, quantidade)
);
