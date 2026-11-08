const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

test('migração protege o Criador ID 2 sem substituir dados da conta', () => {
  const banco = new DatabaseSync(':memory:');
  banco.exec('PRAGMA foreign_keys = ON');
  try {
    const pasta = 'banco-de-dados/migracoes';
    for (const nome of fs.readdirSync(pasta).filter((nome) => nome.endsWith('.sql') && nome < '010').sort()) {
      banco.exec(fs.readFileSync(path.join(pasta, nome), 'utf8'));
    }
    banco.exec(`INSERT INTO usuarios(id,nome,email,senha_hash,perfil,ativo)
      VALUES(2,'Titular protegido','titular@example.test','hash-preservado','administrador',0);
      INSERT INTO sessoes VALUES('sessao',2,'csrf',9999999999999);
      INSERT INTO recuperacoes VALUES('recuperacao',2,9999999999999);
      INSERT INTO restricoes_contas VALUES(2,'banida',NULL)`);
    banco.exec(fs.readFileSync(path.join(pasta, '010-criador-protegido.sql'), 'utf8'));
    const conta = banco.prepare('SELECT * FROM usuarios WHERE id=2').get();
    assert.equal(conta.perfil, 'criador');
    assert.equal(conta.ativo, 1);
    assert.equal(conta.nome, 'Titular protegido');
    assert.equal(conta.senha_hash, 'hash-preservado');
    for (const tabela of ['sessoes', 'recuperacoes', 'restricoes_contas']) {
      assert.equal(banco.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get().n, 0);
    }
    assert.deepEqual(banco.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { banco.close(); }
});

test('banimento e suspensão preservam contas e protegem autenticação e permissões', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'peregrina-restricoes-teste-'));
  process.env.PASTA_DADOS = pasta;
  process.env.NODE_ENV = 'test';
  const { banco } = require('../backend/dados/banco.cjs');
  const acesso = require('../backend/autenticacao/servico.cjs');
  const restricoes = require('../backend/autenticacao/restricoes.cjs');
  const app = require('../backend/aplicacao.cjs');
  const senha = 'SenhaSeguraTeste123';
  const hash = bcrypt.hashSync(senha, 12);
  for (const [id, perfil] of [[1, 'administrador'], [2, 'editor'], [3, 'cliente'], [4, 'administrador']]) {
    banco.prepare('INSERT INTO usuarios(id,nome,email,senha_hash,perfil) VALUES(?,?,?,?,?)')
      .run(id, `Pessoa ${id}`, `p${id}@example.test`, hash, perfil);
  }
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const origem = `http://127.0.0.1:${servidor.address().port}`;
  async function chamar(caminho, sessao, method = 'GET', body, csrf = true) {
    return fetch(origem + caminho, { method, headers: {
      Cookie: `peregrina_admin=${sessao.token}`, 'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': sessao.csrf } : {}),
    }, body: body ? JSON.stringify(body) : undefined });
  }
  try {
    const admin = await acesso.entrar('p1@example.test', senha);
    require('./apoio.cjs').liberarPainelTeste(pasta, admin.token);
    const editor = await acesso.entrar('p2@example.test', senha);
    const cliente = await acesso.entrar('p3@example.test', senha);
    const recuperar = acesso.gerarRecuperacao(3, null, 'cliente');
    for (const sessao of [editor, cliente]) {
      assert.equal((await chamar('/api/acesso/contas', sessao)).status, 403);
      assert.equal((await chamar('/api/acesso/contas/3/restricao', sessao, 'PUT', { acao: 'banir' })).status, 403);
    }
    const lista = await (await chamar('/api/acesso/contas', admin)).json();
    assert.equal(lista.length, 4);
    assert.ok(lista.every((conta) => !('senha_hash' in conta) && !('token' in conta)));
    assert.equal((await chamar('/api/acesso/contas/3/restricao', admin, 'PUT', { acao: 'banir' }, false)).status, 403);
    assert.equal((await chamar('/api/acesso/contas/3/restricao', admin, 'PUT', { acao: 'suspender', dias: -1 })).status, 400);
    assert.equal((await chamar('/api/acesso/contas/1/restricao', admin, 'PUT', { acao: 'banir' })).status, 403);
    assert.equal((await chamar('/api/acesso/contas/3/restricao', admin, 'PUT', { acao: 'suspender', dias: 1 })).status, 204);
    assert.equal((await chamar('/api/conta/sessao', cliente)).status, 401);
    await assert.rejects(acesso.entrar('p3@example.test', senha), /E-mail ou senha/);
    await assert.rejects(acesso.recuperar(recuperar, senha, 'cliente'), /Link inválido/);
    assert.equal(banco.prepare('SELECT COUNT(*) AS n FROM sessoes WHERE usuario_id=3').get().n, 0);
    banco.prepare('UPDATE restricoes_contas SET ate = ? WHERE usuario_id=3').run(Date.now() - 1);
    const renovada = await acesso.entrar('p3@example.test', senha);
    assert.ok(renovada.token);
    assert.equal((await chamar('/api/conta/sessao', cliente)).status, 401);
    assert.equal((await chamar('/api/acesso/contas/3/restricao', admin, 'PUT', { acao: 'banir' })).status, 204);
    await assert.rejects(acesso.entrar('p3@example.test', senha), /E-mail ou senha/);
    assert.equal((await chamar('/api/acesso/contas/3/restricao', admin, 'PUT', { acao: 'liberar' })).status, 204);
    assert.ok((await acesso.entrar('p3@example.test', senha)).token);
    assert.throws(() => restricoes.alterar(4, { acao: 'banir' }, admin.usuario), /Somente um Criador/);
    restricoes.alterar(4, { acao: 'suspender', dias: 7 }, admin.usuario);
    assert.throws(() => restricoes.alterar(1, { acao: 'suspender', dias: 7 }, { id: 4 }), /administrador ativo/);
    assert.throws(() => acesso.alterarUsuario(1, { nome: 'Pessoa 1', perfil: 'editor', ativo: true }, admin.usuario), /administrador ativo/);
    assert.equal(banco.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 4);
    assert.equal(banco.prepare("SELECT COUNT(*) AS n FROM historico WHERE entidade='contas'").get().n, 4);
    assert.throws(() => acesso.alterarUsuario(4, { nome: 'Pessoa 4', perfil: 'criador', ativo: true }, admin.usuario), /Somente um Criador/);
    banco.prepare("UPDATE usuarios SET perfil='criador' WHERE id=4").run();
    banco.prepare('UPDATE restricoes_contas SET ate = 0 WHERE usuario_id=4').run();
    const criador = await acesso.entrar('p4@example.test', senha);
    require('./apoio.cjs').liberarPainelTeste(pasta, criador.token);
    assert.equal(criador.usuario.perfil, 'criador');
    assert.equal((await chamar('/api/acesso/contas', criador)).status, 200);
    assert.equal((await chamar('/api/acesso/usuarios', criador)).status, 200);
    assert.equal((await chamar('/api/acesso/contas/4/restricao', admin, 'PUT', { acao: 'banir' })).status, 403);
    const novoEditor = await acesso.criarUsuario({ nome: 'Editor do Criador', email: 'editor@example.test',
      senha, perfil: 'editor' }, criador.usuario);
    assert.equal(novoEditor.perfil, 'editor');
    const sessaoEditor = await acesso.entrar('editor@example.test', senha);
    const tokenEditor = acesso.gerarRecuperacao(novoEditor.id, criador.usuario);
    const rebaixada = await chamar(`/api/acesso/usuarios/${novoEditor.id}`, criador, 'PUT', {
      nome: novoEditor.nome, perfil: 'cliente', ativo: true,
    });
    assert.equal(rebaixada.status, 200);
    assert.equal((await chamar('/api/acesso/sessao', sessaoEditor)).status, 401);
    await assert.rejects(acesso.recuperar(tokenEditor, senha, 'cliente'), /Link inválido/);
    const sessaoCliente = await acesso.entrar('editor@example.test', senha);
    assert.equal(sessaoCliente.usuario.perfil, 'cliente');
    assert.equal((await chamar('/api/acesso/contas', sessaoCliente)).status, 403);
    const novoCliente = await acesso.criarUsuario({ nome: 'Cliente cadastrado pela equipe',
      email: 'cliente-novo@example.test', senha, perfil: 'cliente' }, criador.usuario);
    assert.equal(novoCliente.perfil, 'cliente');
    assert.equal((await chamar('/api/acesso/contas/3/perfil', admin, 'PUT', { perfil: 'criador' })).status, 403);
    assert.equal((await chamar('/api/acesso/contas/3/perfil', criador, 'PUT', { perfil: 'administrador' })).status, 200);
    assert.equal((await chamar('/api/acesso/contas/3/perfil', criador, 'PUT', { perfil: 'criador' })).status, 200);
    assert.equal((await chamar('/api/acesso/contas/1/restricao', criador, 'PUT', { acao: 'banir' })).status, 204);
    await assert.rejects(acesso.entrar('p1@example.test', senha), /E-mail ou senha/);
    assert.equal((await chamar('/api/acesso/contas/3/restricao', criador, 'PUT', { acao: 'banir' })).status, 204);
    banco.prepare("UPDATE usuarios SET perfil='criador' WHERE id=2").run();
    for (const acao of ['banir', 'suspender', 'liberar']) {
      assert.equal((await chamar('/api/acesso/contas/2/restricao', criador, 'PUT', { acao, dias: 7 })).status, 403);
    }
    assert.equal((await chamar('/api/acesso/contas/2/perfil', criador, 'PUT', { perfil: 'administrador' })).status, 403);
    assert.equal((await chamar('/api/acesso/usuarios/2', criador, 'PUT', { nome: 'Pessoa 2', perfil: 'editor', ativo: false })).status, 403);
    assert.equal((await chamar('/api/acesso/usuarios/2/recuperacao', criador, 'POST', {})).status, 403);
    assert.equal((await chamar('/api/acesso/usuarios/2/sessoes', criador, 'DELETE')).status, 403);
    assert.deepEqual(banco.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    await new Promise((resolver) => servidor.close(resolver));
    banco.close();
    const alvo = path.resolve(pasta);
    assert.equal(path.dirname(alvo), path.resolve(os.tmpdir()));
    assert.ok(path.basename(alvo).startsWith('peregrina-restricoes-teste-'));
    fs.rmSync(alvo, { recursive: true, force: true });
  }
});
