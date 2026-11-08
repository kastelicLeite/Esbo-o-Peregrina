const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function mensagem() {
  const fonte = fs.readFileSync('frontend/js/inicio/formulario.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
  return import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);
}

test('formulário da landing reúne material, quantidade, prazo e detalhes sem confirmar pedido', async () => {
  const { mensagemContato } = await mensagem();
  const texto = mensagemContato({ nome: 'Empresa de teste', material: 'Sacolas personalizadas',
    quantidade: '1000', prazo: 'Até 15 dias', detalhes: 'Duplex 190g, impressão na frente.' });
  assert.match(texto, /Nome ou empresa: Empresa de teste/);
  assert.match(texto, /Material: Sacolas personalizadas/);
  assert.match(texto, /Quantidade: 1\.000 unidades/);
  assert.match(texto, /Prazo desejado: Até 15 dias/);
  assert.match(texto, /Detalhes: Duplex 190g, impressão na frente\./);
  assert.match(texto, /confirmar as opções, o valor e o prazo/);
  const simples = mensagemContato({ nome: 'Cliente', material: 'Outro material', quantidade: '1' });
  assert.match(simples, /Prazo desejado: A combinar/);
  assert.ok(!simples.includes('undefined'));
});

test('materiais da landing têm nomes únicos e descrições completas para o formulário', async () => {
  const fonte = fs.readFileSync('frontend/js/inicio/materiais.js', 'utf8');
  const { materiais } = await import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);
  assert.equal(materiais.length, 12);
  assert.equal(new Set(materiais.map((item) => item.nome)).size, 12);
  assert.ok(materiais.every((item) => item.texto && item.icone && item.detalhes.length === 3));
});
