const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fonte = fs.readFileSync(path.join(__dirname, '../frontend/js/pesquisa-produtos.js'), 'utf8');
const modulo = import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);
const produtos = [
  { id: 1, nome: 'Cartão de Visita', descricao: 'Papel couché personalizado' },
  { id: 2, nome: 'Panfleto', descricao: 'Divulgação com cartão de desconto' },
  { id: 3, nome: 'Adesivos', descricao: 'Vinil recortado' },
];

test('pesquisa reconhece acentos, palavras incompletas e erros de digitação', async () => {
  const { pesquisarProdutos } = await modulo;
  for (const termo of ['cartao', 'CARTÃO', 'catao', 'vista', 'cartao vista', 'catao de visita', 'cart', 'catrao']) {
    assert.equal(pesquisarProdutos(produtos, termo)[0]?.id, 1, termo);
  }
  assert.equal(pesquisarProdutos(produtos, 'couche')[0]?.id, 1);
  assert.equal(pesquisarProdutos(produtos, 'visita cartão')[0]?.id, 1);
});

test('pesquisa prioriza o nome e evita resultados sem relação', async () => {
  const { pesquisarProdutos } = await modulo;
  assert.deepEqual(pesquisarProdutos(produtos, 'cartao').map((item) => item.id), [1, 2]);
  assert.deepEqual(pesquisarProdutos(produtos, 'computador'), []);
  assert.deepEqual(pesquisarProdutos(produtos, 'cartao vinil'), []);
  assert.deepEqual(pesquisarProdutos(produtos, '   '), produtos);
  assert.deepEqual(produtos.map((item) => item.id), [1, 2, 3]);
});
