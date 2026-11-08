const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('saúde verifica banco e escrita sem expor dados e informa falhas com 503', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'peregrina-saude-'));
  process.env.PASTA_DADOS = pasta;
  const { banco } = require('../backend/dados/banco.cjs');
  const { saude } = require('../backend/http/saude.cjs');
  const agora = Date.now;
  let instante = agora();
  Date.now = () => instante;
  let status;
  let dados;
  const resposta = { set() { return this; }, status(valor) { status = valor; return this; }, json(valor) { dados = valor; } };
  try {
    saude({}, resposta);
    assert.equal(status, 200);
    assert.deepEqual(dados, { status: 'ok' });
    assert.equal(fs.readdirSync(path.join(pasta, 'imagens')).length, 0);
    fs.renameSync(path.join(pasta, 'imagens'), path.join(pasta, 'imagens-suspensas'));
    instante += 6000;
    saude({}, resposta);
    assert.equal(status, 503);
    assert.deepEqual(dados, { status: 'indisponivel' });
    fs.renameSync(path.join(pasta, 'imagens-suspensas'), path.join(pasta, 'imagens'));
    instante += 6000;
    saude({}, resposta);
    assert.equal(status, 200);
    banco.close();
    instante += 6000;
    saude({}, resposta);
    assert.equal(status, 503);
  } finally { Date.now = agora; fs.rmSync(pasta, { recursive: true, force: true }); }
});
