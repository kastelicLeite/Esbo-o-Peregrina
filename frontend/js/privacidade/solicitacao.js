const assuntos = {
  ajuda: 'Ajuda com minha conta',
  acesso: 'Consulta dos meus dados',
  correcao: 'Correção dos meus dados',
  exclusao: 'Solicitação de exclusão da conta e dos dados',
};
const emailValido = valor => typeof valor === 'string' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(valor);

export function prepararSolicitacao(dados, configuracao) {
  const assunto = assuntos[dados.tipo];
  const email = String(dados.email || '').trim();
  const detalhes = String(dados.detalhes || '').trim();
  if (!assunto || !emailValido(email) || email.length > 180 || detalhes.length > 1000) {
    throw new Error('Confira o e-mail e os detalhes da solicitação.');
  }
  const mensagem = ['Olá, equipe Peregrina!', assunto + '.', `E-mail da minha conta: ${email}`,
    detalhes ? `Detalhes: ${detalhes}` : '', 'Podem orientar os próximos passos, por favor?'].filter(Boolean).join('\n\n');
  const contato = emailValido(configuracao.contato_privacidade) ? configuracao.contato_privacidade
    : emailValido(configuracao.email) ? configuracao.email : null;
  const whatsapp = /^\d{10,15}$/.test(configuracao.whatsapp || '') ? configuracao.whatsapp : null;
  if (!contato && !whatsapp) throw new Error('O canal de atendimento está indisponível. Tente novamente mais tarde.');
  return {
    mensagem,
    email: contato ? `mailto:${contato}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem)}` : null,
    whatsapp: whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}` : null,
  };
}
