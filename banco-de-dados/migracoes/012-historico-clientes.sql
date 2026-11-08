CREATE TABLE preferencias_historico (
    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);
CREATE TABLE historico_clientes (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('pesquisa', 'visualizacao', 'orcamento')),
    assinatura TEXT NOT NULL,
    dados TEXT NOT NULL,
    criado_em INTEGER NOT NULL,
    UNIQUE (usuario_id, tipo, assinatura)
);
CREATE INDEX historico_clientes_usuario_data ON historico_clientes(usuario_id, criado_em DESC);
