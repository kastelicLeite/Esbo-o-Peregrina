const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('recomendações usam sinais recentes, explicam motivos e mantêm produtos únicos e disponíveis', async () => {
  const { recomendarProdutos } = await import('data:text/javascript;base64,' + Buffer.from(
    fs.readFileSync('frontend/js/recomendacoes.js', 'utf8')).toString('base64'));
  const catalogo = [
    { id: 1, nome: 'Caneta azul', categoria_id: 1, categoria: 'Canetas', variacoes: [{}] },
    { id: 2, nome: 'Caneta rosa', categoria_id: 1, categoria: 'Canetas', variacoes: [{}] },
    { id: 3, nome: 'Adesivo', categoria_id: 2, categoria: 'Adesivos', destaque: true, variacoes: [{}] },
    { id: 4, nome: 'Panfleto', categoria_id: 3, categoria: 'Panfletos', variacoes: [{}] },
    { id: 5, nome: 'Indisponível', categoria_id: 1, variacoes: [] },
  ];
  const agora = Date.now();
  const pesquisa = { tipo: 'pesquisa', dados: { termo: 'CANETA' }, criado_em: agora };
  assert.equal(recomendarProdutos(catalogo)[0].produto.id, 3);
  assert([1, 2].includes(recomendarProdutos(catalogo, [pesquisa])[0].produto.id));
  assert.match(recomendarProdutos(catalogo, [pesquisa])[0].motivo, /pesquisas/);
  assert.equal(recomendarProdutos(catalogo, [{ ...pesquisa, criado_em: agora - 91 * 86400000 }])[0].produto.id, 3);
  const orcamento = { tipo: 'orcamento', dados: { itens: [{ produto_id: 4 }] }, criado_em: agora };
  assert.equal(recomendarProdutos(catalogo, [orcamento])[0].produto.id, 4);
  assert.match(recomendarProdutos(catalogo, [orcamento])[0].motivo, /orçamentos/);
  const vistos = { tipo: 'visualizacao', dados: { produto_id: 1 }, criado_em: agora };
  assert.match(recomendarProdutos(catalogo, [vistos])[0].motivo, /viu/);
  const resultado = recomendarProdutos([...catalogo, catalogo[0]], [pesquisa], 3);
  assert.equal(resultado.length, 3);
  assert.equal(new Set(resultado.map(item => item.produto.id)).size, 3);
  assert(!resultado.some(item => item.produto.id === 5));
  assert.deepEqual(recomendarProdutos([], [pesquisa]), []);
});
