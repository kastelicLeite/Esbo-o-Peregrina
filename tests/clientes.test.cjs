const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const { liberarPainelTeste } = require('./apoio.cjs');

test('clientes reutilizam as contas existentes com isolamento e recuperação segura', async (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'peregrina-clientes-teste-'));
  process.env.PASTA_DADOS = pasta;
  process.env.NODE_ENV = 'test';
  const antigo = new DatabaseSync(path.join(pasta, 'peregrina.sqlite'));
  antigo.exec('PRAGMA foreign_keys = ON; CREATE TABLE migracoes (nome TEXT PRIMARY KEY, aplicado_em TEXT DEFAULT CURRENT_TIMESTAMP)');
  for (const nome of fs.readdirSync('banco-de-dados/migracoes').filter((nome) => nome < '006')) {
    antigo.exec(fs.readFileSync(path.join('banco-de-dados/migracoes', nome), 'utf8'));
    antigo.prepare('INSERT INTO migracoes (nome) VALUES (?)').run(nome);
  }
  const senha = 'MinhaSenhaSegura123!';
  const hashAntigo = bcrypt.hashSync(senha, 12);
  antigo.prepare("INSERT INTO usuarios (id, nome, email, senha_hash, perfil) VALUES (7, 'Equipe original', 'admin@example.test', ?, 'administrador')").run(hashAntigo);
  antigo.exec("INSERT INTO historico VALUES (12, 7, 'Equipe original', 'Teste preservado', 'equipe', '7', CURRENT_TIMESTAMP)");
  antigo.exec("INSERT INTO sessoes VALUES ('sessao-antiga', 7, 'csrf-antigo', 9999999999999)");
  antigo.exec("INSERT INTO recuperacoes VALUES ('recuperacao-antiga', 7, 9999999999999)");
  antigo.close();

  const { banco } = require('../backend/dados/banco.cjs');
  const acesso = require('../backend/autenticacao/servico.cjs');
  const email = require('../backend/autenticacao/email.cjs');
  const aplicacao = require('../backend/aplicacao.cjs');
  const servidor = aplicacao.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const origem = `http://127.0.0.1:${servidor.address().port}`;
  const fetchOriginal = global.fetch;
  const enviados = [];
  let falharEmail = false;
  global.fetch = async (url, opcoes) => {
    if (url === 'https://api.resend.com/emails') {
      if (falharEmail) return new Response('{}', { status: 500 });
      enviados.push(JSON.parse(opcoes.body));
      return new Response(JSON.stringify({ id: 'email-de-teste' }));
    }
    return fetchOriginal(url, opcoes);
  };
  async function chamar(rota, metodo = 'GET', dados, sessao, extras = {}) {
    const resposta = await fetchOriginal(origem + rota, {
      method: metodo, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', ...(sessao ? { Cookie: sessao.cookie, 'X-CSRF-Token': sessao.csrf } : {}), ...extras },
      body: dados === undefined ? undefined : JSON.stringify(dados),
    });
    const texto = await resposta.text();
    let corpo;
    try { corpo = JSON.parse(texto); } catch { corpo = texto; }
    return { status: resposta.status, corpo, cookie: resposta.headers.get('set-cookie')?.split(';')[0], cabecalhos: resposta.headers };
  }
  async function entrar(email, equipe = false, senhaAtual = senha) {
    const resposta = await chamar(equipe ? '/api/acesso/entrar' : '/api/conta/entrar', 'POST', { email, senha: senhaAtual });
    assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
    assert.match(resposta.cabecalhos.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.equal(resposta.corpo.token, undefined);
    assert.equal(resposta.corpo.usuario.senha_hash, undefined);
    if (resposta.corpo.usuario.perfil !== 'cliente') liberarPainelTeste(pasta, resposta.cookie.split('=')[1]);
    return { cookie: resposta.cookie, csrf: resposta.corpo.csrf, usuario: resposta.corpo.usuario };
  }
  let cliente;
  let admin;
  let clienteId;
  try {
    await t.test('migração preserva usuários, hashes, sessões, recuperação e auditoria', () => {
      assert.equal(banco.prepare('SELECT senha_hash FROM usuarios WHERE id = 7').get().senha_hash, hashAntigo);
      assert.equal(banco.prepare('SELECT autor FROM historico WHERE id = 12').get().autor, 'Equipe original');
      assert.ok(banco.prepare("SELECT 1 FROM sessoes WHERE token_hash = 'sessao-antiga'").get());
      assert.ok(banco.prepare("SELECT 1 FROM recuperacoes WHERE token_hash = 'recuperacao-antiga'").get());
      assert.deepEqual(banco.prepare('PRAGMA foreign_key_check').all(), []);
    });
    await t.test('cadastro normaliza e-mail, ignora privilégios e não revela duplicação', async () => {
      const dados = { nome: 'Cliente teste', email: '  CLIENTE@example.test ', senha, confirmacao: senha, perfil: 'administrador', ativo: 0, id: 7 };
      const novo = await chamar('/api/conta/cadastro', 'POST', dados);
      assert.equal(novo.status, 201);
      const registro = banco.prepare("SELECT * FROM usuarios WHERE email = 'cliente@example.test'").get();
      clienteId = registro.id;
      assert.equal(registro.perfil, 'cliente');
      assert.equal(registro.ativo, 1);
      assert.notEqual(registro.id, 7);
      assert.ok(await bcrypt.compare(senha, registro.senha_hash));
      const duplicado = await chamar('/api/conta/cadastro', 'POST', dados);
      assert.deepEqual(duplicado.corpo, novo.corpo);
      assert.equal(duplicado.status, novo.status);
      await chamar('/api/conta/cadastro', 'POST', { ...dados, email: 'admin@example.test' });
      assert.equal(banco.prepare('SELECT perfil FROM usuarios WHERE id = 7').get().perfil, 'administrador');
      const invalido = await chamar('/api/conta/cadastro', 'POST', { ...dados, senha: 'Á'.repeat(40) + 'A1', confirmacao: 'Á'.repeat(40) + 'A1' });
      assert.equal(invalido.status, 400);
    });
    await t.test('login unificado exige e-mail e preserva permissões nas APIs e HTML', async () => {
      assert.equal((await chamar('/api/acesso/entrar', 'POST', { senha })).status, 401);
      assert.equal((await chamar('/api/acesso/entrar', 'POST', { email: 'cliente@example.test', senha })).status, 200);
      assert.equal((await chamar('/api/conta/entrar', 'POST', { email: 'admin@example.test', senha })).status, 200);
      admin = await entrar('admin@example.test', true);
      cliente = await entrar('CLIENTE@example.test');
      for (const rota of ['/api/admin/produtos/1/edicao-rapida', '/api/admin/manual', '/api/admin/produtos', '/api/admin/midias', '/api/admin/banco/usuarios',
        '/api/acesso/usuarios', '/api/acesso/sessao', '/paginas/painel-admin.html',
        '/%70aginas/painel-admin.html', '/paginas%5cpainel-admin.html',
        '/paginas/painel-admin.html.', '/admin/banco']) {
        assert.equal((await chamar(rota, 'GET', undefined, cliente)).status, 403, rota);
      }
      assert.equal((await chamar('/api/conta/sessao', 'GET', undefined, admin)).corpo.usuario.perfil, 'administrador');
      const propriaConta = await chamar('/api/conta/nome', 'PATCH', {
        nome: 'Equipe original', id: clienteId, perfil: 'cliente',
      }, admin);
      assert.equal(propriaConta.status, 200);
      assert.equal(propriaConta.corpo.usuario.id, 7);
      assert.equal(propriaConta.corpo.usuario.perfil, 'administrador');
      assert.equal(banco.prepare('SELECT nome FROM usuarios WHERE id = ?').get(clienteId).nome, 'Cliente teste');
      assert.equal((await chamar('/paginas/painel-admin.html', 'GET', undefined, admin)).status, 200);
      assert.equal((await chamar('/api/admin/produtos', 'GET', undefined, admin)).status, 200);
      assert.equal((await chamar('/api/acesso/usuarios', 'GET', undefined, admin)).corpo.some((u) => u.perfil === 'cliente'), false);
      for (const [rota, metodo, dados] of [
        [`/api/acesso/usuarios/${clienteId}/recuperacao`, 'POST', {}],
        [`/api/acesso/usuarios/${clienteId}`, 'PUT', { nome: 'Elevado', perfil: 'administrador', ativo: true }],
        [`/api/acesso/usuarios/${clienteId}/sessoes`, 'DELETE', {}],
      ]) assert.equal((await chamar(rota, metodo, dados, admin)).status, 404);
      for (const rota of ['/api/produtos', '/api/site', '/paginas/orcamento.html', '/paginas/produtos.html']) {
        assert.equal((await chamar(rota)).status, 200, rota);
      }
    });
    await t.test('nomes repetidos são bloqueados no cadastro e na edição', async () => {
      const duplicado = await chamar('/api/conta/cadastro', 'POST', {
        nome: '  CLIENTE   TESTE ', email: 'outro-cliente@example.test', senha, confirmacao: senha,
      });
      assert.equal(duplicado.status, 409);
      assert.equal(duplicado.corpo.erro, 'Este nome já está em uso. Escolha outro.');
      assert.equal(banco.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE email = 'outro-cliente@example.test'").get().total, 0);
      const alteracao = await chamar('/api/conta/nome', 'PATCH', { nome: 'EQUIPE ORIGINAL' }, cliente);
      assert.equal(alteracao.status, 409);
      const mantido = await chamar('/api/conta/nome', 'PATCH', { nome: '  Cliente   teste ' }, cliente);
      assert.equal(mantido.status, 200);
      assert.equal(mantido.corpo.usuario.nome, 'Cliente teste');
      assert.throws(() => banco.prepare(`INSERT INTO usuarios (nome, email, senha_hash, perfil)
        VALUES ('CLIENTE TESTE', 'direto@example.test', 'teste', 'cliente')`).run(), /UNIQUE/);
      const contas = require('../backend/autenticacao/clientes.cjs');
      await contas.cadastrar({ nome: 'Ágata Única', email: 'agata@example.test', senha, confirmacao: senha });
      await assert.rejects(contas.cadastrar({ nome: 'ÁGATA ÚNICA', email: 'agata2@example.test', senha, confirmacao: senha }),
        /Este nome já está em uso/);
      await assert.rejects(acesso.criarUsuario({ nome: 'CLIENTE TESTE', email: 'equipe2@example.test', senha, perfil: 'editor' }),
        /Este nome já está em uso/);
    });
    await t.test('conta só altera o próprio nome, exige CSRF e confirma senha atual', async () => {
      assert.equal((await chamar('/api/conta/nome', 'PATCH', { nome: 'Bloqueado' }, cliente, { 'X-CSRF-Token': '' })).status, 403);
      assert.equal((await chamar('/api/conta/nome', 'PATCH', { nome: 'Bloqueado' }, cliente, { Origin: 'https://outro.example' })).status, 403);
      const resposta = await chamar('/api/conta/nome', 'PATCH', { nome: 'Novo nome', id: 7, perfil: 'administrador', email: 'outro@example.test' }, cliente);
      assert.equal(resposta.corpo.usuario.nome, 'Novo nome');
      assert.equal(resposta.corpo.usuario.email, 'cliente@example.test');
      assert.equal(resposta.corpo.usuario.perfil, 'cliente');
      assert.equal(banco.prepare('SELECT nome FROM usuarios WHERE id = 7').get().nome, 'Equipe original');
      assert.equal((await chamar('/api/conta/senha', 'PUT', { senha_atual: 'errada', senha, confirmacao: senha }, cliente)).status, 400);
      assert.equal((await chamar('/api/conta/senha', 'PUT', { senha_atual: senha, senha, confirmacao: 'diferente' }, cliente)).status, 400);
      const outra = await entrar('cliente@example.test');
      const nova = 'MinhaNovaSenha456!';
      assert.equal((await chamar('/api/conta/senha', 'PUT', { senha_atual: senha, senha: nova, confirmacao: nova }, cliente)).status, 200);
      for (const sessao of [cliente, outra]) assert.equal((await chamar('/api/conta/sessao', 'GET', undefined, sessao)).status, 401);
      cliente = await entrar('cliente@example.test', false, nova);
    });
    await t.test('e-mail real configurável, sem exposição de tokens ou confirmação fictícia', async () => {
      delete process.env.RESEND_API_KEY;
      assert.equal((await chamar('/api/conta/solicitar-recuperacao', 'POST', { email: 'cliente@example.test' })).status, 503);
      process.env.RESEND_API_KEY = 'chave-de-teste';
      process.env.EMAIL_REMETENTE = 'Gráfica <conta@example.test>';
      process.env.URL_PUBLICA = 'https://grafica.example.test';
      const inexistente = await chamar('/api/conta/solicitar-recuperacao', 'POST', { email: 'inexistente@example.test' });
      const equipe = await chamar('/api/conta/solicitar-recuperacao', 'POST', { email: 'admin@example.test' });
      const real = await chamar('/api/conta/solicitar-recuperacao', 'POST', { email: 'cliente@example.test' });
      assert.deepEqual(real.corpo, inexistente.corpo);
      assert.deepEqual(real.corpo, equipe.corpo);
      assert.equal(real.status, 202);
      assert.equal(enviados.length, 1);
      assert.deepEqual(enviados[0].to, ['cliente@example.test']);
      const token = enviados[0].text.match(/#token=([a-f0-9]{64})/)[1];
      assert.ok(!JSON.stringify(real.corpo).includes(token));
      const bancoPainel = await chamar('/api/admin/banco/recuperacoes', 'GET', undefined, admin);
      assert.ok(!JSON.stringify(bancoPainel.corpo).includes(token));
      assert.ok(!JSON.stringify(bancoPainel.corpo).includes('token_hash'));
      assert.equal((await chamar('/api/acesso/recuperar', 'POST', { token, senha })).status, 400);
      assert.equal((await chamar('/api/conta/redefinir-senha', 'POST', { token, senha, confirmacao: senha })).status, 200);
      assert.equal((await chamar('/api/conta/sessao', 'GET', undefined, cliente)).status, 401);
      assert.equal((await chamar('/api/conta/redefinir-senha', 'POST', { token, senha, confirmacao: senha })).status, 400);
      cliente = await entrar('cliente@example.test');
      falharEmail = true;
      const falha = await chamar('/api/conta/solicitar-recuperacao', 'POST', { email: 'cliente@example.test' });
      assert.deepEqual(falha.corpo, real.corpo);
      assert.equal(banco.prepare('SELECT COUNT(*) AS total FROM recuperacoes WHERE usuario_id = ?').get(clienteId).total, 0);
    });
    await t.test('links expirados e recuperação da equipe não redefinem senha de cliente', async () => {
      const token = acesso.gerarRecuperacao(clienteId, null, 'cliente');
      banco.prepare('UPDATE recuperacoes SET expira_em = 0 WHERE usuario_id = ?').run(clienteId);
      assert.equal((await chamar('/api/conta/redefinir-senha', 'POST', { token, senha, confirmacao: senha })).status, 400);
      const equipe = acesso.gerarRecuperacao(7);
      assert.equal((await chamar('/api/conta/redefinir-senha', 'POST', { token: equipe, senha, confirmacao: senha })).status, 400);
      assert.equal((await chamar('/api/acesso/recuperar', 'POST', { token: equipe, senha })).status, 200);
      assert.equal((await chamar('/api/acesso/sessao', 'GET', undefined, admin)).status, 401);
    });
    await t.test('equipe gerencia a própria senha e sai pela conta sem alterar permissões', async () => {
      const primeira = await entrar('admin@example.test', true);
      const segunda = await entrar('admin@example.test');
      const senhaCliente = banco.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(clienteId).senha_hash;
      const nova = 'OutraSenhaAdmin678!';
      const resposta = await chamar('/api/conta/senha', 'PUT', {
        senha_atual: senha, senha: nova, confirmacao: nova, id: clienteId, perfil: 'cliente',
      }, primeira);
      assert.equal(resposta.status, 200);
      assert.equal(banco.prepare('SELECT perfil FROM usuarios WHERE id = 7').get().perfil, 'administrador');
      assert.equal(banco.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(clienteId).senha_hash, senhaCliente);
      for (const sessao of [primeira, segunda]) {
        assert.equal((await chamar('/api/conta/sessao', 'GET', undefined, sessao)).status, 401);
      }
      const renovada = await entrar('admin@example.test', false, nova);
      assert.equal((await chamar('/api/conta/sair', 'POST', {}, renovada)).status, 204);
      assert.equal((await chamar('/api/acesso/sessao', 'GET', undefined, renovada)).status, 401);
    });
    await t.test('logout, expiração e limites de tentativas', async () => {
      assert.equal((await chamar('/api/conta/sair', 'POST', {}, cliente)).status, 204);
      assert.equal((await chamar('/api/conta/sessao', 'GET', undefined, cliente)).status, 401);
      cliente = await entrar('cliente@example.test');
      banco.prepare('UPDATE sessoes SET expira_em = 0 WHERE usuario_id = ?').run(clienteId);
      assert.equal((await chamar('/api/conta/sessao', 'GET', undefined, cliente)).status, 401);
      for (const rota of ['/cadastro', '/entrar', '/solicitar-recuperacao', '/redefinir-senha']) {
        let resposta;
        for (let i = 0; i < 11; i++) resposta = await chamar('/api/conta' + rota, 'POST', {});
        assert.equal(resposta.status, 429, rota);
      }
      const ambiente = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      assert.match(acesso.cookie('teste', false), /; Secure$/);
      process.env.NODE_ENV = ambiente;
      assert.equal(email.configuracao().origem, 'https://grafica.example.test');
      assert.deepEqual(banco.prepare('PRAGMA foreign_key_check').all(), []);
    });
  } finally {
    global.fetch = fetchOriginal;
    await new Promise((resolver) => servidor.close(resolver));
    banco.close();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
