const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/js/produtos-relacionados.js'), 'utf8');
const modulo = import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);

test('relacionados priorizam categoria e não repetem produtos', async () => {
  const { selecionarRelacionados } = await modulo;
  const atual = { id: 1, categoria_id: 2 };
  const outro = { id: 3, categoria_id: 2 };
  const resultados = selecionarRelacionados(atual, [atual, { id: 2, categoria_id: 1 }, outro, outro]);
  assert.deepEqual(resultados.map(item => item.id), [3, 2]);
  assert.deepEqual(selecionarRelacionados(atual, [atual]), []);
  assert.equal(selecionarRelacionados(atual, resultados, 1).length, 1);
});
