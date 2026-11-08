const { exigir } = require('../http/validacao.cjs');

function configuracao() {
  let origem;
  try { origem = new URL(process.env.URL_PUBLICA); } catch { /* Validado abaixo. */ }
  exigir(process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE && origem
    && ['http:', 'https:'].includes(origem.protocol) && !origem.username && !origem.password
    && (process.env.NODE_ENV !== 'production' || origem.protocol === 'https:'),
  'A recuperação por e-mail está indisponível. Tente mais tarde ou fale com a equipe.', 503);
  return { chave: process.env.RESEND_API_KEY, remetente: process.env.EMAIL_REMETENTE, origem: origem.origin };
}

async function enviarRecuperacao(email, token, config = configuracao()) {
  const link = `${config.origem}/paginas/recuperar-conta.html#token=${token}`;
  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.remetente,
      to: [email],
      subject: 'Redefinir sua senha | Gráfica Peregrina',
      text: `Recebemos uma solicitação para redefinir sua senha.\n\nAbra este link em até 30 minutos:\n${link}\n\nO link só pode ser usado uma vez. Se você não fez a solicitação, ignore esta mensagem.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resposta.ok) throw new Error('Falha no provedor de e-mail.');
  const resultado = await resposta.json();
  if (!resultado.id) throw new Error('Resposta inválida do provedor de e-mail.');
}

module.exports = { configuracao, enviarRecuperacao };
