const { test } = require('node:test');
const assert = require('node:assert/strict');
const gmail = require('../backend/autenticacao/gmail.cjs');

test('Gmail renova OAuth e envia MIME UTF-8 pela API HTTPS sem expor credenciais', async () => {
  const original = global.fetch;
  const chamadas = [];
  const config = { usuario: 'remetente@gmail.com', cliente: 'cliente', segredo: 'segredo', renovacao: 'renovacao' };
  let falhar = false;
  global.fetch = async (url, opcoes) => {
    chamadas.push({ url, opcoes });
    if (url === 'https://oauth2.googleapis.com/token') {
      assert.equal(opcoes.body.get('refresh_token'), config.renovacao);
      return new Response(JSON.stringify({ access_token: 'acesso-apenas-teste' }));
    }
    assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    assert.equal(opcoes.headers.Authorization, 'Bearer acesso-apenas-teste');
    const mime = Buffer.from(JSON.parse(opcoes.body).raw, 'base64url').toString('utf8');
    assert.match(mime, /To: cliente@example.test/);
    assert.match(mime, /Content-Type: text\/plain; charset=UTF-8/);
    assert(!mime.includes(config.renovacao));
    assert.match(mime, /multipart\/alternative/);
    const limite = mime.match(/boundary="([^"]+)"/)[1];
    const partes = mime.split(`--${limite}`);
    const decodificar = tipo => Buffer.from(partes.find(parte => parte.includes(`Content-Type: ${tipo};`))
      .split('\r\n\r\n')[1].trim(), 'base64').toString('utf8');
    const texto = decodificar('text/plain');
    assert.match(texto, /012345/);
    assert.match(texto, /10 minutos/);
    const html = decodificar('text/html');
    assert.match(html, /012345/);
    assert.match(html, /Gráfica Peregrina/);
    assert.match(html, /10 minutos/);
    assert(!html.includes('<script'));
    return new Response(JSON.stringify(falhar ? {} : { id: 'mensagem-teste' }), { status: falhar ? 403 : 200 });
  };
  try {
    await gmail.enviarCodigo('cliente@example.test', '012345', config);
    assert.equal(chamadas.length, 2);
    const modelo = require('../backend/autenticacao/mensagem-recuperacao.cjs').mensagemRecuperacao('012345');
    await require('../backend/email/gmail.cjs').enviarMensagem({ destinatario: 'cliente@example.test',
      responderPara: 'resposta@example.test', assunto: 'Teste de resposta', ...modelo }, config);
    const mimeContato = Buffer.from(JSON.parse(chamadas.at(-1).opcoes.body).raw, 'base64url').toString('utf8');
    assert.match(mimeContato, /Reply-To: resposta@example.test\r\n/);
    falhar = true;
    await assert.rejects(gmail.enviarCodigo('cliente@example.test', '012345', config), /não aceitou/);
    await assert.rejects(gmail.enviarCodigo('cliente@example.test\r\nBcc: outro@example.test', '012345', config));
  } finally { global.fetch = original; }
});
