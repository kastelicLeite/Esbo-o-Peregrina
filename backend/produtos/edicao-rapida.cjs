const express = require('express');
const { banco, transacao, registrar } = require('../dados/banco.cjs');
const { administrador } = require('../autenticacao/servico.cjs');
const { exigir, texto, inteiro } = require('../http/validacao.cjs');
const { validarEstoque } = require('./validacao.cjs');

const rotas = express.Router();
rotas.use('/produtos/:id/edicao-rapida', administrador);

function obter(id) {
  const produto = banco.prepare('SELECT id, nome, estoque, estado, publicado_json, atualizado_em FROM produtos WHERE id = ?').get(id);
  exigir(produto?.estado === 'publicado' && produto.publicado_json, 'Produto publicado não encontrado.', 404);
  return produto;
}

rotas.get('/produtos/:id/edicao-rapida', (pedido, resposta) => {
  const produto = obter(inteiro(Number(pedido.params.id), 1, Number.MAX_SAFE_INTEGER, 'o produto'));
  resposta.json({ nome: produto.nome, estoque: produto.estoque });
});

rotas.put('/produtos/:id/edicao-rapida', (pedido, resposta) => {
  const id = inteiro(Number(pedido.params.id), 1, Number.MAX_SAFE_INTEGER, 'o produto');
  const dados = pedido.body;
  const nome = texto(dados?.nome, 150, 'o nome do produto');
  exigir(Object.hasOwn(dados, 'estoque') && Object.hasOwn(dados, 'estoque_anterior')
    && typeof dados.nome_anterior === 'string', 'Recarregue os dados antes de editar.');
  const estoque = validarEstoque(dados.estoque);
  const anterior = validarEstoque(dados.estoque_anterior);
  const salvo = transacao(() => {
    const produto = obter(id);
    exigir(produto.nome === dados.nome_anterior && produto.estoque === anterior,
      'O nome ou estoque mudou em outra sessão. Feche e abra a edição para conferir antes de salvar.', 409);
    const publicado = JSON.parse(produto.publicado_json);
    const atualizado = new Date(Math.max(Date.now(), (Date.parse(produto.atualizado_em) || 0) + 1)).toISOString();
    if (publicado.atualizado_em === produto.atualizado_em) publicado.atualizado_em = atualizado;
    publicado.nome = nome;
    banco.prepare('UPDATE produtos SET nome = ?, estoque = ?, atualizado_em = ?, publicado_json = ? WHERE id = ?')
      .run(nome, estoque, atualizado, JSON.stringify(publicado), id);
    registrar(pedido.usuario, 'Atualizou nome e estoque pelo catálogo público', 'produto', id);
    return { nome, estoque };
  });
  resposta.json(salvo);
});

module.exports = rotas;
