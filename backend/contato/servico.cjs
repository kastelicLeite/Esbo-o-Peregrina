const { exigir, texto } = require('../http/validacao.cjs');
const { configuracoes } = require('../conteudo/servico.cjs');
const gmail = require('../email/gmail.cjs');

const assuntos = {
  atendimento: 'Atendimento', produto: 'Dúvida sobre produto', orcamento: 'Orçamento',
  privacidade: 'Privacidade e dados pessoais', outro: 'Outro assunto',
};
const escapar = valor => valor.replace(/[&<>"']/g, caractere => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[caractere]));
let janela = Date.now();
let envios = 0;

function configuracaoEnvio() {
  const config = gmail.configuracao();
  const destinatario = process.env.EMAIL_CONTATO?.trim() || configuracoes().email?.trim() || config.usuario;
  exigir(gmail.emailValido(destinatario), 'O contato por e-mail está indisponível. Fale com a equipe pelo WhatsApp.', 503);
  return { config, destinatario };
}

async function enviar(dados) {
  exigir(dados && typeof dados === 'object' && !Array.isArray(dados), 'Preencha o formulário de contato.');
  exigir(!dados.site_pessoal, 'Não foi possível enviar. Confira os campos e tente novamente.');
  const nome = texto(dados.nome, 100, 'seu nome');
  const email = texto(dados.email, 180, 'seu e-mail').toLowerCase();
  const mensagem = texto(dados.mensagem, 3000, 'sua mensagem');
  exigir(!/[\r\n]/.test(nome) && gmail.emailValido(email), 'Confira o nome e o e-mail para resposta.');
  exigir(mensagem.length >= 10, 'Escreva uma mensagem com pelo menos 10 caracteres.');
  const assunto = assuntos[dados.assunto];
  exigir(typeof assunto === 'string', 'Escolha um assunto válido.');
  const { config, destinatario } = configuracaoEnvio();
  if (Date.now() - janela >= 3600000) { janela = Date.now(); envios = 0; }
  exigir(envios < 30, 'O formulário atingiu o limite de envios. Tente mais tarde ou fale pelo WhatsApp.', 429);
  envios++;
  const textoMensagem = `Nova mensagem pelo site da Gráfica Peregrina\n\nNome: ${nome}\nE-mail para resposta: ${email}\nAssunto: ${assunto}\n\n${mensagem}\n\nUse Responder para falar diretamente com o cliente.`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#16232d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 16px;" align="center">
<table role="presentation" width="100%" style="max-width:580px;background:#ffffff;border:1px solid #dde5eb;border-top:4px solid #00aeef;border-radius:10px;" cellpadding="24" cellspacing="0"><tr><td>
<p style="margin:0 0 12px;color:#00799b;font-size:12px;letter-spacing:1px;">CONTATO PELO SITE</p>
<h1 style="margin:0 0 24px;font-size:24px;">Nova mensagem para a Peregrina</h1>
<p><strong>Nome:</strong> ${escapar(nome)}<br><strong>E-mail:</strong> ${escapar(email)}<br><strong>Assunto:</strong> ${escapar(assunto)}</p>
<div style="margin-top:24px;padding:18px;background:#f3f6f8;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;">${escapar(mensagem)}</div>
<p style="margin-top:24px;color:#647584;font-size:13px;">Use Responder para falar com o cliente. Esta mensagem foi enviada pelo formulário público do site.</p>
</td></tr></table></td></tr></table></body></html>`;
  try {
    await gmail.enviarMensagem({ destinatario, responderPara: email,
      assunto: `[Contato Peregrina] ${assunto}`, texto: textoMensagem, html }, config);
  } catch {
    console.error('Falha no envio do formulário de contato. Verifique a integração Gmail.');
    exigir(false, 'Não foi possível confirmar o envio. Seus campos foram mantidos. Tente novamente mais tarde ou fale pelo WhatsApp.', 502);
  }
  return { mensagem: 'Sua mensagem foi encaminhada para o e-mail da equipe. Obrigado pelo contato!' };
}

module.exports = { enviar, configuracaoEnvio };
