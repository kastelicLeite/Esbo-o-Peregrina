const express = require('express');
const { banco, transacao, registrar } = require('../dados/banco.cjs');
const { exigir, texto, inteiro, slug, gerarSlug } = require('../http/validacao.cjs');
const servico = require('./servico.cjs');
const { atualizarEstoque } = require('./estoque.cjs');

const router = express.Router();

router.use(require('./visao-geral.cjs'));

router.get('/produtos', (pedido, resposta) => {
  const ordens = { id: 'id ASC', recentes: 'atualizado_em DESC', nome: 'nome COLLATE NOCASE', posicao: 'posicao, id' };
  const ordem = ordens[pedido.query.ordem] || ordens.recentes;
  const parametros = [];
  const filtros = [];
  if (pedido.query.busca) {
    const busca = String(pedido.query.busca).slice(0, 150).trim();
    const identificador = busca.match(/^(?:id\s*[:#]?\s*|#\s*)?(\d+)$/i);
    if (identificador) {
      filtros.push('id = ?');
      const id = Number(identificador[1]);
      parametros.push(Number.isSafeInteger(id) ? id : -1);
    } else if (busca) {
      filtros.push('(nome LIKE ? OR descricao LIKE ?)');
      parametros.push(`%${busca}%`, `%${busca}%`);
    }
  }
  if (pedido.query.estado === 'ativos') filtros.push("estado != 'arquivado'");
  else if (pedido.query.estado) {
    filtros.push('estado = ?');
    parametros.push(pedido.query.estado);
  }
  if (pedido.query.categoria) {
    filtros.push('categoria_id = ?');
    parametros.push(Number(pedido.query.categoria));
  }
  if (pedido.query.estoque === 'zerado') filtros.push('estoque = 0');
  if (pedido.query.estoque === 'sem-controle') filtros.push('estoque IS NULL');
  const registros = banco.prepare(`SELECT id FROM produtos ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''} ORDER BY ${ordem}`)
    .all(...parametros).map((item) => {
      const produto = servico.obterProduto(item.id);
      return { ...produto, imagem: servico.imagem(produto.imagem_id), pendencias: servico.pendencias(produto) };
    });
  resposta.json(registros.filter((item) => {
    if (pedido.query.revisao === 'alteracoes') return item.pendente;
    if (pedido.query.revisao === 'prontos') return item.estado === 'rascunho' && !item.pendencias.length;
    if (pedido.query.revisao === 'pendencias') return item.estado !== 'arquivado' && item.pendencias.length > 0;
    return true;
  }));
});

router.get('/produtos/:id', (pedido, resposta) => resposta.json(servico.obterProduto(Number(pedido.params.id))));
router.get('/produtos/:id/previa', (pedido, resposta) => {
  resposta.json(servico.apresentarProduto(servico.obterProduto(Number(pedido.params.id))));
});

router.post('/produtos', (pedido, resposta) => {
  resposta.status(201).json(servico.salvarProduto(null, pedido.body, pedido.usuario));
});

router.put('/produtos/:id', (pedido, resposta) => {
  resposta.json(servico.salvarProduto(Number(pedido.params.id), pedido.body, pedido.usuario));
});

router.put('/produtos/:id/estoque', (pedido, resposta) => {
  const id = inteiro(Number(pedido.params.id), 1, Number.MAX_SAFE_INTEGER, 'o produto');
  resposta.json(atualizarEstoque(id, pedido.body, pedido.usuario));
});

router.delete('/produtos/:id', (pedido, resposta) => {
  const id = inteiro(Number(pedido.params.id), 1, Number.MAX_SAFE_INTEGER, 'o produto');
  servico.excluirProduto(id, pedido.usuario);
  resposta.status(204).end();
});

router.post('/produtos/:id/duplicar', (pedido, resposta) => {
  const original = servico.obterProduto(Number(pedido.params.id));
  const dados = {
    ...original,
    nome: `${original.nome.slice(0, 140)} (cópia)`,
    slug: '',
    estoque: null,
    variacoes: original.variacoes.map((item) => ({ ...item, id: undefined })),
  };
  resposta.status(201).json(servico.salvarProduto(null, dados, pedido.usuario));
});

router.post('/produtos/:id/estado', (pedido, resposta) => {
  resposta.json(transacao(() => servico.alterarEstado(Number(pedido.params.id), pedido.body.acao, pedido.usuario)));
});

router.post('/lote', (pedido, resposta) => {
  exigir(Array.isArray(pedido.body.ids) && pedido.body.ids.length > 0 && pedido.body.ids.length <= 100,
    'Selecione de 1 a 100 produtos.');
  const ids = [...new Set(pedido.body.ids.map((id) => inteiro(id, 1, Number.MAX_SAFE_INTEGER, 'o produto')))];
  transacao(() => ids.forEach((id) => servico.alterarEstado(id, pedido.body.acao, pedido.usuario)));
  resposta.json({ sucesso: true });
});

router.get('/categorias', (pedido, resposta) => {
  resposta.json(banco.prepare('SELECT * FROM categorias ORDER BY posicao, nome').all());
});

function salvarCategoria(id, dados, usuario) {
  exigir(dados && typeof dados === 'object', 'Informe os dados da categoria.');
  const nome = texto(dados.nome, 100, 'o nome da categoria');
  const endereco = slug(dados.slug || gerarSlug(nome));
  const posicao = inteiro(dados.posicao ?? 0, 0, 99999, 'a posição');
  exigir(!banco.prepare('SELECT id FROM categorias WHERE slug = ? AND id != ?').get(endereco, id || 0),
    'Já existe uma categoria com esse endereço.');
  return transacao(() => {
    if (id) {
      exigir(banco.prepare('SELECT id FROM categorias WHERE id = ?').get(id), 'Categoria não encontrada.', 404);
      banco.prepare('UPDATE categorias SET nome = ?, slug = ?, posicao = ?, ativa = ? WHERE id = ?')
        .run(nome, endereco, posicao, dados.ativa === false || dados.ativa === 0 ? 0 : 1, id);
    } else {
      id = Number(banco.prepare('INSERT INTO categorias (nome, slug, posicao) VALUES (?, ?, ?)')
        .run(nome, endereco, posicao).lastInsertRowid);
    }
    registrar(usuario, 'Salvou categoria', 'categoria', id);
    return banco.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
  });
}

router.post('/categorias', (pedido, resposta) => resposta.status(201).json(salvarCategoria(null, pedido.body, pedido.usuario)));
router.put('/categorias/:id', (pedido, resposta) => resposta.json(salvarCategoria(Number(pedido.params.id), pedido.body, pedido.usuario)));

router.get('/exportar', (pedido, resposta) => {
  const produtos = banco.prepare('SELECT id FROM produtos ORDER BY id').all()
    .map((item) => servico.obterProduto(item.id));
  registrar(pedido.usuario, 'Exportou catálogo', 'catalogo', 'json');
  resposta.attachment('catalogo-peregrina.json').json({
    exportado_em: new Date().toISOString(),
    categorias: banco.prepare('SELECT * FROM categorias ORDER BY posicao').all(),
    produtos,
  });
});

module.exports = router;
