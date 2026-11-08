const express = require('express');
const { banco, transacao } = require('./banco.cjs');
const { administrador } = require('../autenticacao/servico.cjs');
const { exigir, inteiro } = require('../http/validacao.cjs');

const router = express.Router();
const tabelas = ['produtos', 'variacoes', 'categorias', 'midias', 'usuarios', 'configuracoes',
  'conteudos', 'historico', 'migracoes', 'sessoes', 'recuperacoes'];
const reservadas = new Set(['senha_hash', 'token_hash', 'csrf']);
router.use('/banco', administrador, require('../autenticacao/acesso-painel.cjs').protegerTabelas);

router.get('/banco', (pedido, resposta) => {
  resposta.json(tabelas.map((nome) => ({
    nome, total: banco.prepare(`SELECT COUNT(*) AS total FROM "${nome}"`).get().total,
  })));
});

router.get('/banco/:tabela/localizar', (pedido, resposta) => {
  const nome = pedido.params.tabela;
  exigir(tabelas.includes(nome), 'Tabela não encontrada.', 404);
  const busca = String(pedido.query.busca || '').trim().slice(0, 200);
  exigir(busca, 'Digite o que deseja localizar.');
  const indice = inteiro(Number(pedido.query.indice || 0), 0, 1000000, 'o resultado');
  const colunas = banco.prepare(`PRAGMA table_info("${nome}")`).all()
    .map((coluna) => coluna.name).filter((coluna) => !reservadas.has(coluna));
  const id = busca.match(/^(?:id\s*[:#]?\s*|#\s*)?(\d+)$/i);
  const porId = id && colunas.includes('id');
  const selecionadas = porId ? ['id'] : colunas;
  const condicoes = selecionadas.map((coluna) => porId ? `CAST("${coluna}" AS TEXT) = ?`
    : `instr(lower(CAST("${coluna}" AS TEXT)), lower(?)) > 0`);
  const termos = selecionadas.map(() => porId ? String(Number(id[1])) : busca);
  const cte = `WITH registros AS (SELECT *, ROW_NUMBER() OVER (ORDER BY rowid DESC) AS posicao_linha FROM "${nome}")`;
  const resultado = transacao(() => {
    const total = banco.prepare(`${cte} SELECT COUNT(*) AS total FROM registros WHERE ${condicoes.join(' OR ')}`).get(...termos).total;
    if (!total) return { total: 0, indice: 0 };
    const atual = indice % total;
    const coluna = `CASE ${condicoes.map((condicao, i) => `WHEN ${condicao} THEN '${selecionadas[i]}'`).join(' ')} END`;
    const linha = banco.prepare(`${cte} SELECT posicao_linha, ${coluna} AS coluna FROM registros
      WHERE ${condicoes.join(' OR ')} ORDER BY posicao_linha LIMIT 1 OFFSET ?`).get(...termos, ...termos, atual);
    return { total, indice: atual, pagina: Math.floor((linha.posicao_linha - 1) / 50) + 1,
      linha: (linha.posicao_linha - 1) % 50, coluna: linha.coluna };
  });
  resposta.json(resultado);
});

router.get('/banco/:tabela', (pedido, resposta) => {
  const nome = pedido.params.tabela;
  exigir(tabelas.includes(nome), 'Tabela não encontrada.', 404);
  const pagina = inteiro(Number(pedido.query.pagina || 1), 1, 1000000, 'a página');
  const tamanho = 50;
  const colunas = banco.prepare(`PRAGMA table_info("${nome}")`).all()
    .filter((coluna) => !reservadas.has(coluna.name))
    .map((coluna) => ({ nome: coluna.name, tipo: coluna.type, chave: Boolean(coluna.pk) }));
  const dados = transacao(() => ({
    total: banco.prepare(`SELECT COUNT(*) AS total FROM "${nome}"`).get().total,
    linhas: banco.prepare(`SELECT ${colunas.map((coluna) => `"${coluna.nome}"`).join(', ')}
      FROM "${nome}" ORDER BY rowid DESC LIMIT ? OFFSET ?`).all(tamanho, (pagina - 1) * tamanho),
  }));
  resposta.json({ tabela: nome, pagina, tamanho, colunas, ...dados });
});

module.exports = router;
