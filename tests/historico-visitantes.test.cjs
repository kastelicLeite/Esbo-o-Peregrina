const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('histórico visitante persiste, pausa, limpa e não é misturado com contas', async () => {
  const originalFetch = global.fetch;
  const originalStorage = global.localStorage;
  const dados = new Map();
  global.localStorage = { getItem: chave => dados.get(chave) ?? null, setItem: (chave, valor) => dados.set(chave, valor) };
  const fonte = fs.readFileSync('frontend/js/historico/cliente.js', 'utf8');
  const importar = nome => import('data:text/javascript;base64,' + Buffer.from(fonte).toString('base64') + '#' + nome);
  try {
    global.fetch = async () => new Response('{}', { status: 401 });
    const visitante = await importar('visitante');
    await visitante.registrarAtividade('pesquisa', { termo: 'canetas' });
    await visitante.registrarAtividade('visualizacao', { produto: { id: 1, nome: 'Caneta', slug: 'caneta', categoria_id: 1 } });
    assert.equal((await visitante.lerHistorico()).eventos.length, 2);
    await visitante.configurarHistorico(false);
    assert.deepEqual(await visitante.registrarAtividade('pesquisa', { termo: 'pesquisa pausada' }), { salvo: false });
    assert.equal((await visitante.lerHistorico()).eventos.length, 2);
    await visitante.limparHistorico('pesquisa');
    assert.equal((await visitante.lerHistorico()).eventos[0].tipo, 'visualizacao');
    const recarregado = await importar('visitante-recarregado');
    assert.equal((await recarregado.lerHistorico()).eventos.length, 1);
    const antes = [...dados.entries()];
    const chamadas = [];
    global.fetch = async (url, opcoes) => {
      chamadas.push({ url, opcoes });
      if (url.endsWith('/sessao')) return Response.json({ usuario: { id: 1 }, csrf: 'csrf-teste' });
      if (opcoes.method === 'GET') return Response.json({ ativo: true, eventos: [], origem: 'conta' });
      return Response.json({ salvo: true });
    };
    const conta = await importar('conta');
    assert.equal((await conta.lerHistorico()).eventos.length, 0);
    await conta.registrarAtividade('pesquisa', { termo: 'somente da conta' });
    assert.deepEqual([...dados.entries()], antes);
    assert(chamadas.some(item => item.opcoes?.headers?.['X-CSRF-Token'] === 'csrf-teste'));
    assert(!JSON.stringify([...dados.entries()]).includes('csrf-teste'));
    global.fetch = async () => { throw Error('Sem conexão'); };
    const offline = await importar('offline');
    await assert.rejects(offline.lerHistorico());
    assert.deepEqual([...dados.entries()], antes);
    global.fetch = async () => new Response('{}', { status: 401 });
    dados.set('peregrina:historico:visitante:v1', '{invalido');
    const corrompido = await importar('corrompido');
    assert.equal((await corrompido.lerHistorico()).falha, true);
    await corrompido.limparHistorico();
    assert.equal((await corrompido.lerHistorico()).eventos.length, 0);
  } finally {
    global.fetch = originalFetch;
    if (originalStorage === undefined) delete global.localStorage;
    else global.localStorage = originalStorage;
  }
});
