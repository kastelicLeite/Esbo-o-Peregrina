const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

test('histórico pertence à sessão, valida orçamentos, limita registros e permite pausar e limpar', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'peregrina-historico-'));
  process.env.PASTA_DADOS = pasta;
  process.env.NODE_ENV = 'test';
  const { banco } = require('../backend/dados/banco.cjs');
  const acesso = require('../backend/autenticacao/servico.cjs');
  const historico = require('../backend/historico/servico.cjs');
  const produtos = require('../backend/produtos/servico.cjs');
  const senha = 'SenhaHistorico123!';
  const hash = await bcrypt.hash(senha, 12);
  let servidor;
  try {
    for (const [id, perfil] of [[1, 'cliente'], [2, 'criador'], [3, 'cliente']]) {
      banco.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)')
        .run(id, `Pessoa ${id}`, `pessoa${id}@example.test`, hash, perfil);
    }
    const imagem = randomUUID();
    banco.prepare(`INSERT INTO midias (id, nome, arquivo, miniatura, alternativo, pasta, largura, altura, bytes)
      VALUES (?, 'Teste', ?, ?, 'Teste', '', 1, 1, 1)`).run(imagem, `${imagem}.webp`, `${imagem}-mini.webp`);
    const produto = produtos.salvarProduto(null, { nome: 'Caneta Azul', slug: 'caneta-azul', descricao: 'Descrição de teste.',
      categoria_id: banco.prepare('SELECT id FROM categorias LIMIT 1').get().id, comercial: 'preco',
      imagem_id: imagem, galeria: [], caracteristicas: [], tiragens: [100],
      variacoes: [{ opcoes: {}, quantidade: 100, total: '10.00', unitario: '0.10', disponivel: true, ativa: true }] }, { id: 2, nome: 'Pessoa 2' });
    produtos.alterarEstado(produto.id, 'publicar', { id: 2, nome: 'Pessoa 2' });
    servidor = require('../backend/aplicacao.cjs').listen(0, '127.0.0.1');
    await once(servidor, 'listening');
    const base = `http://127.0.0.1:${servidor.address().port}`;
    const primeira = await acesso.entrar('pessoa1@example.test', senha);
    const outra = await acesso.entrar('pessoa3@example.test', senha);
    const criador = await acesso.entrar('pessoa2@example.test', senha);
    require('./apoio.cjs').liberarPainelTeste(pasta, criador.token);
    const chamar = (method, body, sessao = primeira, sufixo = '', csrf = sessao?.csrf) => fetch(base + '/api/conta/historico' + sufixo, {
      method, headers: { 'Content-Type': 'application/json', ...(sessao ? {
        Cookie: acesso.cookie(sessao.token, false).split(';')[0], 'X-CSRF-Token': csrf } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal((await chamar('GET', undefined, null)).status, 401);
    assert.equal((await chamar('POST', { tipo: 'pesquisa', termo: 'caneta' }, primeira, '', 'errado')).status, 403);
    assert.equal((await chamar('POST', { tipo: 'pesquisa', termo: 'caneta', usuario_id: 3 })).status, 200);
    await chamar('POST', { tipo: 'pesquisa', termo: ' CANETA ' });
    assert.equal(historico.ler(1).eventos.length, 1);
    const segundoDispositivo = await acesso.entrar('pessoa1@example.test', senha);
    assert.equal((await (await chamar('GET', undefined, segundoDispositivo)).json()).eventos.length, 1);
    assert.equal((await (await chamar('GET', undefined, outra, '?usuario_id=1')).json()).eventos.length, 0);
    await chamar('POST', { tipo: 'visualizacao', produto_id: produto.id, nome: 'Nome falso' });
    await chamar('POST', { tipo: 'visualizacao', produto_id: produto.id });
    const visto = historico.ler(1).eventos.find(item => item.tipo === 'visualizacao');
    assert.equal(visto.dados.nome, 'Caneta Azul');
    assert.equal(historico.ler(1).eventos.filter(item => item.tipo === 'visualizacao').length, 1);
    const itens = [{ produto_id: produto.id, quantidade: 100, opcoes: {}, total_centavos: 1 }];
    const enviado = await chamar('POST', { tipo: 'orcamento', itens, estado: 'enviado', usuario_id: 3 });
    assert.equal(enviado.status, 200);
    const resumo = historico.ler(1).eventos.find(item => item.tipo === 'orcamento').dados;
    assert.equal(resumo.estado, 'preparado');
    assert.equal(resumo.itens[0].total_centavos, 1000);
    assert.equal(resumo.subtotal_centavos, 1000);
    assert.equal((await chamar('POST', { tipo: 'orcamento', itens: [{ ...itens[0], quantidade: 250 }] })).status, 400);
    assert.equal((await chamar('POST', { tipo: 'orcamento', origem: 'produto', itens: [{ ...itens[0], quantidade: 250 }] })).status, 200);
    assert(historico.ler(1).eventos.some(item => item.tipo === 'orcamento' && item.dados.itens[0].total_centavos === null));
    assert.equal((await chamar('POST', { tipo: 'visualizacao', produto_id: 999999 })).status, 404);
    assert.equal((await chamar('POST', { tipo: 'tipo-invalido' })).status, 400);
    for (let i = 0; i < 55; i++) historico.registrar(1, { tipo: 'pesquisa', termo: `Pesquisa ${i}` });
    assert.equal(historico.ler(1).eventos.filter(item => item.tipo === 'pesquisa').length, 50);
    assert.equal((await chamar('PUT', { ativo: false }, primeira, '/preferencia')).status, 204);
    const quantidade = historico.ler(1).eventos.length;
    assert.deepEqual(await (await chamar('POST', { tipo: 'pesquisa', termo: 'Nova pesquisa pausada' })).json(), { salvo: false });
    assert.equal(historico.ler(1).eventos.length, quantidade);
    assert.equal((await chamar('PUT', { ativo: true }, primeira, '/preferencia')).status, 204);
    historico.registrar(3, { tipo: 'pesquisa', termo: 'Pesquisa da outra pessoa' });
    assert.equal((await chamar('DELETE', { tipo: 'visualizacao', usuario_id: 3 })).status, 204);
    assert(!historico.ler(1).eventos.some(item => item.tipo === 'visualizacao'));
    assert(historico.ler(1).eventos.some(item => item.tipo === 'pesquisa'));
    assert.equal(historico.ler(3).eventos.length, 1);
    banco.prepare('UPDATE historico_clientes SET criado_em = ? WHERE usuario_id = 1 AND tipo = ?')
      .run(Date.now() - 91 * 86400000, 'orcamento');
    assert(!historico.ler(1).eventos.some(item => item.tipo === 'orcamento'));
    assert.equal((await chamar('DELETE', { usuario_id: 3 })).status, 204);
    assert.equal(historico.ler(1).eventos.length, 0);
    assert.equal(historico.ler(3).eventos.length, 1);
    const painel = await fetch(base + '/api/admin/banco/historico_clientes', { headers: {
      Cookie: acesso.cookie(criador.token, false).split(';')[0] } });
    assert.equal(painel.status, 404);
    assert.deepEqual(banco.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    if (servidor) await new Promise(resolver => servidor.close(resolver));
    banco.close();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
