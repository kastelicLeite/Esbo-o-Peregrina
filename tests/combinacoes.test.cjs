const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('compatibilidade preserva preços e IDs, permite cancelar e não duplica ao reativar', async () => {
  const fonte = fs.readFileSync('frontend/js/admin/compatibilidade-produto.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
  const { aplicarCompatibilidades } = await import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);
  const original = [{ id: 1, opcoes: { tamanho: 'p', material: 'papel' }, quantidade: 100,
    total: '45.00', unitario: '0.45', ativa: true, disponivel: true }];
  const desativadas = aplicarCompatibilidades(original, [{ item: original[0], permitido: false }]);
  assert.equal(original[0].disponivel, true);
  assert.equal(desativadas[0].disponivel, false);
  assert.equal(desativadas[0].total, '45.00');
  const reativadas = aplicarCompatibilidades(desativadas, [{ item: original[0], permitido: true }]);
  assert.equal(reativadas.length, 1);
  assert.equal(reativadas[0].id, 1);
  assert.equal(reativadas[0].unitario, '0.45');
  const nova = { opcoes: { tamanho: 'g', material: 'papel' }, quantidade: 100, total: '', unitario: '' };
  const resultado = aplicarCompatibilidades(original, [{ item: nova, permitido: true }]);
  assert.equal(resultado.length, 2);
  assert.equal(resultado[1].total, '');
  assert.equal(resultado[1].disponivel, true);
  assert.equal(aplicarCompatibilidades(original, [{ item: nova, permitido: false }]).length, 1);
});

test('gerador respeita grupos escolhidos, preços existentes e limite de combinações', async () => {
  const fonte = fs.readFileSync('frontend/js/admin/gerador-combinacoes.js', 'utf8').replace(/^import .*;\r?\n/, '');
  const { gerarCombinacoes } = await import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);
  const existente = { opcoes: { material: 'papel', tamanho: 'pequeno' }, quantidade: 100, total: '45.00' };
  const grupos = [{ id: 'tamanho', valores: ['pequeno', 'grande'] }, { id: 'material', valores: ['papel'] }];
  const novas = gerarCombinacoes(grupos, [100, 500], [existente]);
  assert.equal(novas.length, 3);
  assert.ok(novas.every((item) => item.opcoes.material === 'papel' && item.total === ''));
  assert.equal(existente.total, '45.00');
  assert.throws(() => gerarCombinacoes(grupos, [], []), /Marque/);
  assert.throws(() => gerarCombinacoes([{ id: 'tamanho', valores: [] }], [100], []), /Marque/);
  assert.throws(() => gerarCombinacoes(grupos, Array.from({ length: 251 }, (_, i) => i + 1), []), /limite/);
});
