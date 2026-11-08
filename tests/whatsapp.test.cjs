const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fonte = fs.readFileSync(path.join(__dirname, '../frontend/js/configuracao.js'), 'utf8');
const modulo = import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);

test('mensagem do produto separa identificação, especificações e quantidade', async () => {
  const { linkWhatsapp } = await modulo;
  const url = new URL(linkWhatsapp('Cartão de Visita', ['Material: Couché 250g', 'Tamanho: 8,8 × 4,8 cm'], 1000));
  assert.equal(url.pathname, '/5511911116541');
  assert.equal(url.searchParams.get('text'), [
    'Olá! Gostaria de solicitar um orçamento.',
    '*Produto:* Cartão de Visita',
    '*Especificações*\n• Material: Couché 250g\n• Tamanho: 8,8 × 4,8 cm',
    '*Quantidade:* 1.000 unidades',
    'Podem confirmar o valor e o prazo de produção, por favor?',
  ].join('\n\n'));
});

test('contato geral continua usando a mensagem configurada', async () => {
  const { configuracao, linkWhatsapp } = await modulo;
  assert.equal(new URL(linkWhatsapp()).searchParams.get('text'), configuracao.mensagem);
});
