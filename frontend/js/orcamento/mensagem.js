export const dinheiroOrcamento = (centavos) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(centavos / 100);

export function mensagemOrcamento(validacao) {
  if (!validacao.pode_enviar) throw new Error('Revise os itens indisponíveis antes de continuar.');
  const blocos = ['Olá! Gostaria de solicitar um orçamento para os seguintes produtos:'];
  validacao.itens.forEach((item, indice) => {
    const linhas = [`*${indice + 1}. ${item.nome}*`];
    linhas.push(...item.especificacoes.map((opcao) => `• ${opcao.nome}: ${opcao.valor}`));
    linhas.push(`• Quantidade: ${new Intl.NumberFormat('pt-BR').format(item.quantidade)} unidades (1 lote)`);
    if (item.unitario_centavos != null) linhas.push(`• Por unidade: ${dinheiroOrcamento(item.unitario_centavos)}`);
    linhas.push(item.total_centavos === null ? '• Valor: Sob orçamento'
      : `• Preço aproximado do item: ${dinheiroOrcamento(item.total_centavos)}`);
    blocos.push(linhas.join('\n'));
  });
  if (validacao.com_preco) blocos.push(`*${validacao.sob_orcamento ? 'Subtotal dos itens com preço' : 'Total dos itens'} (preço aproximado): ${dinheiroOrcamento(validacao.subtotal_centavos)}*`);
  if (validacao.sob_orcamento) blocos.push('Os itens sem preço precisam de orçamento.');
  blocos.push('Podem confirmar os valores e o prazo de produção, por favor?');
  return blocos.join('\n\n');
}

export function prepararLinkOrcamento(numero, mensagem, limite = 7000) {
  const conversa = `https://wa.me/${numero}`;
  const link = `${conversa}?text=${encodeURIComponent(mensagem)}`;
  return { link: link.length <= limite ? link : conversa, precisaCopiar: link.length > limite };
}
