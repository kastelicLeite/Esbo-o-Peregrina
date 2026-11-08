const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fonte = fs.readFileSync(path.join(__dirname, '../frontend/js/admin/rascunho-produto.js'), 'utf8');
const modulo = import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);

function armazenamento() {
  const dados = new Map();
  return {
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => dados.set(chave, valor),
    removeItem: (chave) => dados.delete(chave),
  };
}

test('recupera cadastro completo, isola usuários e produtos e permite limpar', async () => {
  const { criarRascunhoProduto } = await modulo;
  const local = armazenamento();
  const dados = {
    nome: 'Cartão', descricao: 'Descrição ainda em edição', imagem_id: 'imagem-1',
    galeria: ['imagem-2'], caracteristicas: [{ nome: 'Material', valores: [{ nome: 'Couché' }] }],
    tiragens: [500], variacoes: [{ quantidade: 500, total: '98.20' }],
  };
  const novo = criarRascunhoProduto(local, 1);
  assert.equal(novo.gravar(dados, '500, 100', 'versao-inicial'), true);
  const recuperado = criarRascunhoProduto(local, 1).ler();
  assert.deepEqual(recuperado.dados, dados);
  assert.equal(recuperado.quantidades, '500, 100');
  assert.equal(recuperado.baseAtualizado, 'versao-inicial');
  assert.equal(criarRascunhoProduto(local, 2).ler(), null);
  assert.equal(criarRascunhoProduto(local, 1, 12).ler(), null);
  const existente = criarRascunhoProduto(local, 1, 12);
  existente.gravar(dados, '500', 'versao-produto');
  assert.equal(novo.limpar(), true);
  assert.equal(novo.ler(), null);
  assert.deepEqual(existente.ler().dados, dados);
});

test('armazenamento bloqueado ou corrompido não impede o cadastro', async () => {
  const { criarRascunhoProduto } = await modulo;
  const bloqueado = criarRascunhoProduto(undefined, 1);
  assert.equal(bloqueado.ler(), null);
  assert.equal(bloqueado.gravar({}, ''), false);
  assert.equal(bloqueado.limpar(), false);
  const corrompido = criarRascunhoProduto({ getItem: () => '{incompleto' }, 1);
  assert.equal(corrompido.ler(), null);
  const formatoInvalido = criarRascunhoProduto({ getItem: () => '{"versao":1,"dados":{}}' }, 1);
  assert.equal(formatoInvalido.ler(), null);
});
