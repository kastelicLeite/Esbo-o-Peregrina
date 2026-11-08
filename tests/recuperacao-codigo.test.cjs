const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcryptjs');

test('recuperação por código Gmail valida etapas, tentativas e permissões no servidor', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'peregrina-codigo-'));
  process.env.PASTA_DADOS = pasta;
  process.env.NODE_ENV = 'test';
  const { banco } = require('../backend/dados/banco.cjs');
  const gmail = require('../backend/autenticacao/gmail.cjs');
  const codigos = require('../backend/autenticacao/recuperacao-codigo.cjs');
  const acesso = require('../backend/autenticacao/servico.cjs');
  const enviado = gmail.enviarCodigo;
  const mensagens = [];
  let falhar = false;
  gmail.enviarCodigo = async (email, codigo) => {
    if (falhar) throw Error('Falha simulada somente no teste');
    mensagens.push({ email, codigo });
  };
  const senha = 'SenhaAnterior123!';
  const nova = 'SenhaAtualizada456!';
  const hash = await bcrypt.hash(senha, 12);
  for (const [id, perfil] of [[1, 'cliente'], [2, 'criador'], [3, 'administrador']]) {
    banco.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)')
      .run(id, `Conta ${id}`, `conta${id}@example.test`, hash, perfil);
  }
  const redefinir = permissao => codigos.redefinir({ permissao, senha: nova, confirmacao: nova });
  const liberarReenvio = id => banco.prepare('UPDATE recuperacoes_codigos SET criado_em = 0 WHERE usuario_id = ?').run(id);
  try {
    assert.throws(() => codigos.conferirEmail({ email: 'ninguem@example.test' }), /E-mail incorreto/);
    assert.equal(codigos.conferirEmail({ email: 'CONTA1@example.test' }).mensagem, 'E-mail conferido.');
    delete process.env.GMAIL_USUARIO;
    delete process.env.GMAIL_REFRESH_TOKEN;
    await assert.rejects(codigos.solicitar({ email: 'conta1@example.test' }), erro => erro.status === 503);
    process.env.GMAIL_USUARIO = 'remetente@gmail.com';
    process.env.GMAIL_CLIENT_ID = 'cliente-apenas-teste';
    process.env.GMAIL_CLIENT_SECRET = 'segredo-apenas-teste';
    process.env.GMAIL_REFRESH_TOKEN = 'renovacao-apenas-teste';
    const inicio = await codigos.solicitar({ email: 'CONTA1@example.test' });
    assert.match(mensagens[0].codigo, /^\d{6}$/);
    const inexistente = await codigos.solicitar({ email: 'ninguem@example.test' });
    assert.equal(inexistente.mensagem, inicio.mensagem);
    assert.match(inexistente.desafio, /^[a-f0-9]{64}$/);
    assert.equal(mensagens.length, 1);
    assert(!JSON.stringify(inicio).includes(mensagens[0].codigo));
    assert(!JSON.stringify(banco.prepare('SELECT * FROM recuperacoes_codigos').all()).includes(inicio.desafio));
    assert.throws(() => codigos.validar({ desafio: inexistente.desafio, codigo: '123456' }));
    await codigos.solicitar({ email: 'conta1@example.test' });
    assert.equal(mensagens.length, 1);
    await assert.rejects(redefinir(inicio.desafio));
    const errado = mensagens[0].codigo === '000000' ? '000001' : '000000';
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      assert.throws(() => codigos.validar({ desafio: inicio.desafio, codigo: errado }));
    }
    assert.throws(() => codigos.validar({ desafio: inicio.desafio, codigo: mensagens[0].codigo }));
    liberarReenvio(1);
    const manual = acesso.gerarRecuperacao(1, null, 'cliente');
    const outro = await codigos.solicitar({ email: 'conta1@example.test' });
    assert.throws(() => codigos.validar({ desafio: inicio.desafio, codigo: mensagens[0].codigo }));
    const sessao = await acesso.entrar('conta1@example.test', senha);
    const validado = codigos.validar({ desafio: outro.desafio, codigo: mensagens.at(-1).codigo });
    assert.match(validado.permissao, /^[a-f0-9]{64}$/);
    assert.throws(() => codigos.validar({ desafio: outro.desafio, codigo: mensagens.at(-1).codigo }));
    await assert.rejects(codigos.redefinir({ permissao: validado.permissao, senha: nova, confirmacao: 'diferente' }));
    await redefinir(validado.permissao);
    assert.equal(banco.prepare('SELECT COUNT(*) AS total FROM sessoes WHERE usuario_id = 1').get().total, 0);
    assert.equal(banco.prepare('SELECT COUNT(*) AS total FROM recuperacoes WHERE usuario_id = 1').get().total, 0);
    assert.equal(banco.prepare('SELECT COUNT(*) AS total FROM recuperacoes_codigos WHERE usuario_id = 1').get().total, 0);
    assert(sessao.token && manual);
    await assert.rejects(redefinir(validado.permissao));
    await assert.rejects(acesso.entrar('conta1@example.test', senha));
    assert((await acesso.entrar('conta1@example.test', nova)).usuario);

    for (const id of [2, 3]) {
      const pedido = await codigos.solicitar({ email: `conta${id}@example.test` });
      const validacao = codigos.validar({ desafio: pedido.desafio, codigo: mensagens.at(-1).codigo });
      await redefinir(validacao.permissao);
      assert.equal(banco.prepare('SELECT perfil FROM usuarios WHERE id = ?').get(id).perfil,
        id === 2 ? 'criador' : 'administrador');
    }
    const expirado = await codigos.solicitar({ email: 'conta1@example.test' });
    banco.prepare('UPDATE recuperacoes_codigos SET expira_em = 0 WHERE usuario_id = 1').run();
    assert.throws(() => codigos.validar({ desafio: expirado.desafio, codigo: mensagens.at(-1).codigo }));
    const expirarPermissao = await codigos.solicitar({ email: 'conta1@example.test' });
    const permissao = codigos.validar({ desafio: expirarPermissao.desafio, codigo: mensagens.at(-1).codigo }).permissao;
    banco.prepare('UPDATE recuperacoes_codigos SET expira_em = 0 WHERE usuario_id = 1').run();
    await assert.rejects(redefinir(permissao));
    falhar = true;
    const falha = await codigos.solicitar({ email: 'conta1@example.test' });
    assert.equal(falha.mensagem, inexistente.mensagem);
    assert.equal(banco.prepare('SELECT tentativas FROM recuperacoes_codigos WHERE usuario_id = 1').get().tentativas, 5);
    falhar = false;
    liberarReenvio(1);
    const alterada = await codigos.solicitar({ email: 'conta1@example.test' });
    banco.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = 1').run(await bcrypt.hash(senha, 12));
    assert.throws(() => codigos.validar({ desafio: alterada.desafio, codigo: mensagens.at(-1).codigo }));
    liberarReenvio(1);
    const inativa = await codigos.solicitar({ email: 'conta1@example.test' });
    banco.prepare('UPDATE usuarios SET ativo = 0 WHERE id = 1').run();
    assert.throws(() => codigos.validar({ desafio: inativa.desafio, codigo: mensagens.at(-1).codigo }));
    assert.deepEqual(banco.prepare('PRAGMA foreign_key_check').all(), []);

    const servidor = require('../backend/aplicacao.cjs').listen(0, '127.0.0.1');
    await require('node:events').once(servidor, 'listening');
    const origem = `http://127.0.0.1:${servidor.address().port}`;
    const chamar = (rota, dados, headers = {}) => fetch(origem + '/api/conta/' + rota, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(dados),
    });
    try {
      assert.equal((await chamar('conferir-email-recuperacao', { email: 'ninguem@example.test' })).status, 400);
      assert.equal((await chamar('conferir-email-recuperacao', { email: 'conta3@example.test' })).status, 200);
      liberarReenvio(3);
      const pedido = await chamar('solicitar-codigo', { email: 'conta3@example.test' });
      assert.equal(pedido.status, 202);
      const dados = await pedido.json();
      assert.equal((await chamar('validar-codigo', { desafio: dados.desafio, codigo: mensagens.at(-1).codigo },
        { Origin: 'https://outra-origem.example' })).status, 403);
      const validado = await chamar('validar-codigo', { desafio: dados.desafio, codigo: mensagens.at(-1).codigo });
      assert.equal(validado.status, 200);
      const autorizacao = await validado.json();
      assert.equal((await chamar('redefinir-com-codigo', { permissao: autorizacao.permissao,
        senha: nova, confirmacao: nova })).status, 200);
      for (const [rota, total] of [['solicitar-codigo', 5], ['validar-codigo', 20], ['redefinir-com-codigo', 10]]) {
        let resposta;
        for (let i = 0; i <= total; i++) resposta = await chamar(rota, {});
        assert.equal(resposta.status, 429);
      }
    } finally { await new Promise(resolver => servidor.close(resolver)); }
  } finally {
    gmail.enviarCodigo = enviado;
    banco.close();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
