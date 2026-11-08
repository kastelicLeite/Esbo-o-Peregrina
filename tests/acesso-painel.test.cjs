const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const bcrypt = require('bcryptjs');

test('senha compartilhada protege painel e APIs sem substituir permissões individuais', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'peregrina-porta-painel-'));
  process.env.PASTA_DADOS = pasta;
  process.env.NODE_ENV = 'test';
  const { banco } = require('../backend/dados/banco.cjs');
  const acesso = require('../backend/autenticacao/servico.cjs');
  const app = require('../backend/aplicacao.cjs');
  const senha = 'SenhaIndividualTeste123';
  const compartilhada = 'SenhaDaEquipeTeste123';
  const nova = 'NovaSenhaDaEquipe123';
  const hash = bcrypt.hashSync(senha, 12);
  for (const [id, perfil] of [[1, 'administrador'], [2, 'criador'], [3, 'editor'], [4, 'cliente']]) {
    banco.prepare('INSERT INTO usuarios(id,nome,email,senha_hash,perfil) VALUES(?,?,?,?,?)')
      .run(id, `Pessoa ${id}`, `p${id}@example.test`, hash, perfil);
  }
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const origem = `http://127.0.0.1:${servidor.address().port}`;
  async function chamar(rota, sessao, method = 'GET', body, csrf = sessao?.csrf) {
    return fetch(origem + rota, { method, redirect: 'manual', headers: {
      ...(sessao ? { Cookie: `peregrina_admin=${sessao.token}` } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}), 'Content-Type': 'application/json',
    }, body: body ? JSON.stringify(body) : undefined });
  }
  try {
    const admin = await acesso.entrar('p1@example.test', senha);
    const criador = await acesso.entrar('p2@example.test', senha);
    const editor = await acesso.entrar('p3@example.test', senha);
    const cliente = await acesso.entrar('p4@example.test', senha);
    assert.equal((await chamar('/api/painel/acesso')).status, 401);
    assert.equal((await chamar('/api/painel/acesso', cliente)).status, 403);
    assert.equal((await chamar('/api/produtos', cliente)).status, 200);
    for (const rota of ['/api/admin/produtos', '/api/admin/manual', '/api/acesso/usuarios', '/api/acesso/contas']) {
      const resposta = await chamar(rota, admin);
      assert.equal(resposta.status, 403, rota);
      assert.equal((await resposta.json()).codigo, 'SENHA_PAINEL');
    }
    for (const rota of ['/paginas/painel-admin.html', '/admin/banco', '/admin/banco/visualizador.js']) {
      const resposta = await chamar(rota, admin);
      assert.equal(resposta.status, 303);
      assert.equal(resposta.headers.get('location'), rota === '/paginas/painel-admin.html'
        ? '/paginas/acesso-painel.html' : '/paginas/acesso-painel.html?destino=banco');
    }
    const dados = { senha: compartilhada, confirmacao: compartilhada };
    banco.prepare('UPDATE usuarios SET ativo = 0 WHERE id = 2').run();
    assert.equal((await (await chamar('/api/painel/acesso', admin)).json()).pode_configurar, false);
    assert.equal((await chamar('/api/painel/acesso', admin, 'PUT', dados)).status, 403);
    banco.prepare('UPDATE usuarios SET ativo = 1 WHERE id = 2').run();
    assert.equal((await chamar('/api/painel/acesso', criador, 'PUT', dados, 'errado')).status, 403);
    assert.equal((await chamar('/api/painel/acesso', criador, 'PUT', dados)).status, 200);
    const registro = banco.prepare('SELECT senha_hash FROM senha_painel').get();
    assert.notEqual(registro.senha_hash, compartilhada);
    assert.equal(await bcrypt.compare(compartilhada, registro.senha_hash), true);
    assert.equal((await chamar('/api/admin/manual', criador)).status, 200);
    const resumoCriador = await (await chamar('/api/admin/visao-geral', criador)).json();
    assert.equal(resumoCriador.backup.ativo, true);
    assert.equal(resumoCriador.contas.total, 4);
    assert.equal((await chamar('/api/painel/acesso', admin, 'POST', { senha: 'errada' })).status, 401);
    assert.equal((await chamar('/api/painel/acesso', admin, 'POST', { senha: compartilhada })).status, 200);
    assert.equal((await chamar('/paginas/painel-admin.html', admin)).status, 200);
    assert.equal((await chamar('/api/admin/produtos', admin)).status, 200);
    const bancoBloqueado = await chamar('/api/admin/banco', admin);
    assert.equal((await bancoBloqueado.json()).codigo, 'SENHA_TABELAS');
    assert.equal((await chamar('/api/painel/acesso', admin, 'POST', { senha: compartilhada, destino: 'banco' })).status, 200);
    assert.equal((await chamar('/api/admin/banco', admin)).status, 200);
    assert.equal((await chamar('/admin/banco', admin)).status, 200);
    banco.prepare('UPDATE acessos_tabelas SET expira_em = 0').run();
    assert.equal((await chamar('/api/admin/banco', admin)).status, 403);
    assert.equal((await chamar('/api/painel/acesso', editor, 'POST', { senha: compartilhada })).status, 200);
    assert.equal((await chamar('/api/admin/manual', editor)).status, 200);
    assert.equal((await chamar('/api/acesso/usuarios', editor)).status, 403);
    const estado = await (await chamar('/api/painel/acesso', admin)).json();
    assert.equal(estado.liberado, true);
    assert.equal(JSON.stringify(estado).includes(registro.senha_hash), false);
    const outraSessao = await acesso.entrar('p1@example.test', senha);
    assert.equal((await chamar('/api/admin/manual', outraSessao)).status, 403);
    assert.equal((await chamar('/api/painel/acesso', criador, 'PUT', {
      senha_atual: compartilhada, senha: nova, confirmacao: nova,
    })).status, 200);
    assert.equal((await chamar('/api/admin/manual', admin)).status, 403);
    assert.equal((await chamar('/api/admin/manual', editor)).status, 403);
    assert.equal((await chamar('/api/painel/acesso', admin, 'POST', { senha: compartilhada })).status, 401);
    assert.equal((await chamar('/api/painel/acesso', admin, 'POST', { senha: nova })).status, 200);
    banco.prepare('UPDATE acessos_painel SET expira_em = 0 WHERE token_hash = ?').run(acesso.resumir(admin.token));
    assert.equal((await chamar('/api/admin/manual', admin)).status, 403);
    assert.equal((await chamar('/api/painel/acesso', admin, 'POST', { senha: nova })).status, 200);
    assert.equal((await chamar('/api/acesso/sair', admin, 'POST', {})).status, 204);
    assert.equal(banco.prepare('SELECT 1 FROM acessos_painel WHERE token_hash = ?').get(acesso.resumir(admin.token)), undefined);
    assert.equal((await chamar('/api/admin/manual', admin)).status, 401);
    let bloqueada;
    for (let i = 0; i < 11; i++) bloqueada = await chamar('/api/painel/acesso', criador, 'POST', { senha: 'errada' });
    assert.equal(bloqueada.status, 429);
  } finally {
    await new Promise((resolver) => servidor.close(resolver));
    banco.close();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
