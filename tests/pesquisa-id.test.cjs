const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/js/admin/pesquisa-id.js'), 'utf8');
const modulo = import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);

test('ID 1 não retorna IDs 13 e 6 com número 1 na descrição', async () => {
  const { identificarId, filtrarIdExato } = await modulo;
  const produtos = [
    { id: 13, descricao: '1 unidade' }, { id: 6, descricao: 'Papel 100g' }, { id: 1, descricao: 'Cartão' },
  ];
  for (const busca of ['1', '#1', 'ID 1', 'ID #1', ' 1 ']) {
    assert.deepEqual(filtrarIdExato(produtos, identificarId(busca)).map((item) => item.id), [1]);
  }
  assert.deepEqual(filtrarIdExato(produtos, identificarId('99')), []);
  assert.equal(identificarId('Cartão'), null);
  assert.equal(filtrarIdExato(produtos, null), produtos);
});
