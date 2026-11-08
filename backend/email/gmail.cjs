const { randomUUID } = require('node:crypto');
const { exigir } = require('../http/validacao.cjs');

const emailValido = valor => typeof valor === 'string'
  && /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(valor);

function configuracao() {
  const usuario = process.env.GMAIL_USUARIO?.trim();
  const cliente = process.env.GMAIL_CLIENT_ID?.trim();
  const segredo = process.env.GMAIL_CLIENT_SECRET?.trim();
  const renovacao = process.env.GMAIL_REFRESH_TOKEN?.trim();
  exigir(emailValido(usuario) && cliente && segredo && renovacao,
    'O envio de e-mail está indisponível. Tente mais tarde ou fale com a equipe.', 503);
  return { usuario, cliente, segredo, renovacao };
}

async function enviarMensagem(dados, config = configuracao()) {
  exigir(emailValido(dados.destinatario) && (!dados.responderPara || emailValido(dados.responderPara)), 'Endereço de e-mail inválido.');
  const autorizacao = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: config.cliente, client_secret: config.segredo,
      refresh_token: config.renovacao, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(10000),
  });
  if (!autorizacao.ok) throw new Error('Não foi possível autorizar o envio pelo Gmail.');
  const credenciais = await autorizacao.json();
  if (!credenciais.access_token) throw new Error('Autorização inválida do Gmail.');
  const assunto = Buffer.from(dados.assunto).toString('base64');
  const limite = `peregrina-${randomUUID()}`;
  const codificar = conteudo => Buffer.from(conteudo).toString('base64').match(/.{1,76}/g).join('\r\n');
  const mensagem = [
    `From: Peregrina <${config.usuario}>`, `To: ${dados.destinatario}`,
    ...(dados.responderPara ? [`Reply-To: ${dados.responderPara}`] : []),
    `Subject: =?UTF-8?B?${assunto}?=`, 'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${limite}"`, '',
    `--${limite}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    codificar(dados.texto), `--${limite}`, 'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '', codificar(dados.html), `--${limite}--`, '',
  ].join('\r\n');
  const resposta = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${credenciais.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: Buffer.from(mensagem).toString('base64url') }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resposta.ok || !(await resposta.json()).id) throw new Error('O Gmail não aceitou o envio.');
}

module.exports = { configuracao, enviarMensagem, emailValido };
