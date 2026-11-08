const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

test('contato envia apenas para a empresa, permite resposta e protege o formulário público', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'peregrina-contato-'));
  process.env.PASTA_DADOS = pasta;
  process.env.NODE_ENV = 'test';
  process.env.GMAIL_USUARIO = 'empresa@gmail.com';
  process.env.GMAIL_CLIENT_ID = 'cliente-apenas-teste';
  process.env.GMAIL_CLIENT_SECRET = 'segredo-apenas-teste';
  process.env.GMAIL_REFRESH_TOKEN = 'token-apenas-teste';
  const { banco } = require('../backend/dados/banco.cjs');
  const gmail = require('../backend/email/gmail.cjs');
  const contato = require('../backend/contato/servico.cjs');
  const original = gmail.enviarMensagem;
  const enviados = [];
  let falhar = false;
  let servidor;
  gmail.enviarMensagem = async dados => {
    if (falhar) throw Error('Falha do provedor apenas no teste');
    enviados.push(dados);
  };
  const dados = { nome: 'Cliente de teste', email: 'cliente@example.test', assunto: 'produto',
    mensagem: 'Gostaria de saber mais sobre as canetas.', destinatario: 'outro@example.test', cc: 'outro@example.test' };
  try {
    await contato.enviar(dados);
    assert.equal(enviados[0].destinatario, 'empresa@gmail.com');
    assert.equal(enviados[0].responderPara, dados.email);
    assert.equal(enviados[0].cc, undefined);
    assert.match(enviados[0].texto, /Cliente de teste/);
    await contato.enviar({ ...dados, nome: '<b>Cliente</b>', mensagem: '<script>alert(1)</script> Mensagem de teste.' });
    assert(!enviados.at(-1).html.includes('<script>'));
    assert(enviados.at(-1).html.includes('&lt;script&gt;'));
    const config = JSON.parse(banco.prepare('SELECT dados FROM configuracoes').get().dados);
    config.email = 'atendimento@example.test';
    banco.prepare('UPDATE configuracoes SET dados = ?').run(JSON.stringify(config));
    await contato.enviar(dados);
    assert.equal(enviados.at(-1).destinatario, 'atendimento@example.test');
    process.env.EMAIL_CONTATO = 'contato-especifico@example.test';
    await contato.enviar(dados);
    assert.equal(enviados.at(-1).destinatario, process.env.EMAIL_CONTATO);
    delete process.env.EMAIL_CONTATO;
    const antes = enviados.length;
    for (const alteracao of [
      { nome: '' }, { nome: 'Cliente\r\nBcc: outra@example.test' }, { email: 'email-incorreto' },
      { email: 'cliente@example.test\r\nBcc: outra@example.test' }, { mensagem: 'Curta' },
      { mensagem: 'a'.repeat(3001) }, { assunto: '__proto__' }, { site_pessoal: 'https://spam.example' },
    ]) await assert.rejects(contato.enviar({ ...dados, ...alteracao }), erro => erro.status === 400);
    assert.equal(enviados.length, antes);
    falhar = true;
    await assert.rejects(contato.enviar(dados), erro => erro.status === 502 && !erro.message.includes('token-apenas-teste'));
    falhar = false;
    delete process.env.GMAIL_REFRESH_TOKEN;
    await assert.rejects(contato.enviar(dados), erro => erro.status === 503);
    process.env.GMAIL_REFRESH_TOKEN = 'token-apenas-teste';

    servidor = require('../backend/aplicacao.cjs').listen(0, '127.0.0.1');
    await once(servidor, 'listening');
    const base = `http://127.0.0.1:${servidor.address().port}`;
    const chamar = (body, origin = base) => fetch(base + '/api/contato', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
    assert.deepEqual(await (await fetch(base + '/api/contato')).json(), { disponivel: true });
    assert.equal((await chamar(dados, 'https://outra-origem.example')).status, 403);
    const sucesso = await chamar(dados);
    assert.equal(sucesso.status, 200);
    assert.match((await sucesso.json()).mensagem, /encaminhada/);
    falhar = true;
    const falha = await chamar(dados);
    assert.equal(falha.status, 502);
    assert(!JSON.stringify(await falha.json()).includes('encaminhada'));
    falhar = false;
    let limite;
    for (let i = 0; i < 6; i++) limite = await chamar({});
    assert.equal(limite.status, 429);
    const tabelas = banco.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    assert(!tabelas.some(item => item.name === 'mensagens_contato'));
    for (let i = 0; i < 31; i++) {
      try { await contato.enviar(dados); }
      catch (erro) { assert.equal(erro.status, 429); break; }
    }
    await assert.rejects(contato.enviar(dados), erro => erro.status === 429);
  } finally {
    gmail.enviarMensagem = original;
    if (servidor) await new Promise(resolver => servidor.close(resolver));
    banco.close();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
