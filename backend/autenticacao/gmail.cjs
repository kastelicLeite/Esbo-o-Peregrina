const { exigir } = require('../http/validacao.cjs');
const gmail = require('../email/gmail.cjs');
const { mensagemRecuperacao } = require('./mensagem-recuperacao.cjs');

async function enviarCodigo(destinatario, codigo, config = gmail.configuracao()) {
  exigir(typeof codigo === 'string' && /^\d{6}$/.test(codigo), 'Código inválido.');
  const { texto, html } = mensagemRecuperacao(codigo);
  await gmail.enviarMensagem({ destinatario, assunto: 'Seu código de recuperação | Gráfica Peregrina', texto, html }, config);
}

module.exports = { configuracao: gmail.configuracao, enviarCodigo };
