const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function carregar() {
  const fonte = fs.readFileSync('frontend/js/admin/previa-dados.js', 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);
}

function produto() {
  return { nome: 'Cartão', categoria_id: 1, comercial: 'preco', imagem_id: 'capa', galeria: ['outra'],
    tiragens: [500, 100], caracteristicas: [{ id: 'material', nome: 'Material', ativo: true, tipo: 'selecao',
      valores: [{ id: 'papel', nome: 'Papel', ativo: true, imagem_id: 'outra' },
        { id: 'antigo', nome: 'Antigo', ativo: false }] }],
    variacoes: [
      { opcoes: { material: 'papel' }, quantidade: 100, total: '159,00', unitario: '1,59', ativa: true, disponivel: true },
      { opcoes: { material: 'papel' }, quantidade: 500, total: '795.00', ativa: true, disponivel: true },
      { opcoes: { material: 'antigo' }, quantidade: 100, total: '10.00', ativa: true, disponivel: true },
      { opcoes: { material: 'papel' }, quantidade: 250, total: '', ativa: true, disponivel: true },
    ] };
}

test('prévia preserva ordem, vínculos de imagens e preços sem alterar o rascunho', async () => {
  const { produtoParaPrevia } = await carregar();
  const dados = produto();
  const antes = structuredClone(dados);
  const midias = [{ id: 'capa', url: '/capa.webp' }, { id: 'outra', url: '/outra.webp', miniatura_url: '/outra-mini.webp' }];
  const previa = produtoParaPrevia(dados, midias, [{ id: 1, nome: 'Papelaria' }]);
  assert.deepEqual(dados, antes);
  assert.deepEqual(previa.tiragens, [500, 100]);
  assert.equal(previa.variacoes.length, 2);
  assert.equal(previa.variacoes[0].total_centavos, 15900);
  assert.equal(previa.variacoes[0].unitario_centavos, 159);
  assert.equal(previa.caracteristicas[0].valores[0].imagem.miniatura, '/outra-mini.webp');
  assert.equal(previa.categoria, 'Papelaria');
});

test('simulação mantém configuração válida e se recupera de tiragem removida sem modificar cadastro', async () => {
  const { produtoParaPrevia, selecionarNaPrevia } = await carregar();
  const dados = produto();
  const previa = produtoParaPrevia(dados, [], []);
  assert.equal(selecionarNaPrevia(previa, { quantidade: 500, opcoes: { material: 'papel' } }).quantidade, 500);
  assert.equal(selecionarNaPrevia(previa, { quantidade: 250, opcoes: { material: 'papel' } }).quantidade, 100);
  dados.comercial = 'orcamento';
  assert.ok(produtoParaPrevia(dados, [], []).variacoes.every((item) => item.total_centavos === null));
});
