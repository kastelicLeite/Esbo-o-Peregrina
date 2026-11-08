CREATE TABLE restricoes_contas (
    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('banida', 'suspensa')),
    ate INTEGER,
    CHECK ((tipo = 'banida' AND ate IS NULL) OR (tipo = 'suspensa' AND ate IS NOT NULL))
);
