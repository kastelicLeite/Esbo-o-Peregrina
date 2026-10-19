CREATE TABLE produtos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    preco NUMERIC(12, 2) NOT NULL,
    descricao TEXT NOT NULL,

    CONSTRAINT produtos_nome_preenchido CHECK (TRIM(nome) <> ''),
    CONSTRAINT produtos_preco_nao_negativo CHECK (preco >= 0)
);
