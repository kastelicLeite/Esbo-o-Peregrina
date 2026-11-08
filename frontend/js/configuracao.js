export const configuracao = {
  whatsapp: '5511911116541',
  telefone: '+55 (11) 91111-6541',
  mensagem: 'Olá! Gostaria de solicitar um orçamento com a Gráfica Peregrina.',
  mensagem_produto: 'Olá! Gostaria de um orçamento para {produto}.',
};

let consulta;

export async function carregarSite(recarregar = false) {
  if (recarregar) consulta = null;
  if (!consulta) {
    const previa = new URLSearchParams(location.search).get('previa') === '1';
    consulta = fetch(previa ? '/api/admin/previa-site' : '/api/site', { cache: 'no-store' })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error('Não foi possível carregar os dados do site.');
        const dados = await resposta.json();
        Object.assign(configuracao, dados.configuracoes);
        return dados;
      }).catch((erro) => { consulta = null; throw erro; });
  }
  return consulta;
}

export function linkWhatsapp(produto, opcoes = [], quantidade) {
  const blocos = [];
  if (produto) {
    const modeloPadrao = 'Olá! Gostaria de um orçamento para {produto}.';
    const introducao = configuracao.mensagem_produto === modeloPadrao
      ? 'Olá! Gostaria de solicitar um orçamento.'
      : configuracao.mensagem_produto.replaceAll('{produto}', produto);
    blocos.push(introducao.trim(), `*Produto:* ${produto}`);
    if (opcoes.length) blocos.push(`*Especificações*\n${opcoes.map((opcao) => `• ${opcao}`).join('\n')}`);
    if (quantidade) blocos.push(`*Quantidade:* ${new Intl.NumberFormat('pt-BR').format(quantidade)} unidades`);
    blocos.push('Podem confirmar o valor e o prazo de produção, por favor?');
  } else {
    blocos.push(configuracao.mensagem.trim());
  }
  const mensagem = blocos.filter(Boolean).join('\n\n');
  return `https://wa.me/${configuracao.whatsapp}?text=${encodeURIComponent(mensagem)}`;
}
