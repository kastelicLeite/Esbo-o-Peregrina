const { test } = require('node:test');
const assert = require('node:assert/strict');
const { enderecoPublico, validarUrl, importarUrl } = require('../backend/midias/importar-url.cjs');

test('importação aceita HTTPS e bloqueia protocolos e credenciais indevidos', () => {
  assert.equal(validarUrl('https://example.com/imagem.png').hostname, 'example.com');
  for (const valor of ['http://example.com/a.png', 'file:///dados/imagem.png', 'https://user:senha@example.com/a',
    'https://example.com:8080/a', 'não é um link']) {
    assert.throws(() => validarUrl(valor));
  }
});

test('importação rejeita endereços locais, privados e mapeados', async () => {
  for (const endereco of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2002:7f00:1::']) {
    assert.equal(enderecoPublico(endereco), false, endereco);
  }
  assert.equal(enderecoPublico('8.8.8.8'), true);
  assert.equal(enderecoPublico('2606:4700:4700::1111'), true);
  await assert.rejects(importarUrl('https://127.0.0.1/imagem.png'), /Endereços locais/);
});
