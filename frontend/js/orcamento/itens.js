import { dinheiroOrcamento } from './mensagem.js';

export function elemento(tag, classe, texto) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}

export function mostrarItens(container, salvos, validacao, acoes) {
  container.replaceChildren();
  if (!salvos.length) {
    const vazio = elemento('div', 'orcamento-vazio');
    vazio.append(elemento('h2', '', 'Seu carrinho está vazio'),
      elemento('p', '', 'Escolha os produtos e adicione as opções que você precisa.'));
    const link = elemento('a', 'botao', 'Conhecer os produtos');
    link.href = '/paginas/produtos.html';
    vazio.append(link);
    container.append(vazio);
    return;
  }
  for (const salvo of salvos) {
    const atual = validacao.itens.find((item) => item.id === salvo.id);
    const card = elemento('article', `item-carrinho${atual?.disponivel ? '' : ' item-indisponivel'}`);
    const foto = atual?.imagem?.miniatura || salvo.referencia.imagem;
    if (foto) {
      const imagem = elemento('img', 'imagem-item-carrinho');
      imagem.src = foto;
      imagem.alt = atual?.imagem?.alternativo || salvo.referencia.nome;
      imagem.width = 100;
      imagem.height = 100;
      card.append(imagem);
    }
    const dados = elemento('div', 'dados-item-carrinho');
    dados.append(elemento('h2', '', atual?.nome || salvo.referencia.nome));
    if (atual?.disponivel) {
      const detalhes = elemento('ul', 'opcoes-item-carrinho');
      atual.especificacoes.forEach((opcao) => detalhes.append(elemento('li', '', `${opcao.nome}: ${opcao.valor}`)));
      dados.append(detalhes);
    }
    dados.append(elemento('p', 'quantidade-item-carrinho',
      `${new Intl.NumberFormat('pt-BR').format(salvo.quantidade)} unidades · 1 lote`));
    if (!atual?.disponivel) dados.append(elemento('p', 'aviso-item-carrinho', atual?.motivo || 'Não foi possível conferir este item.'));
    else {
      dados.append(elemento('p', 'preco-item-carrinho', atual.total_centavos === null
        ? 'Sob orçamento' : `${atual.aproximado ? 'Preço aproximado' : 'Total do item'}: ${dinheiroOrcamento(atual.total_centavos)}`));
      if (atual.unitario_centavos !== null) dados.append(elemento('p', 'unitario-item-carrinho',
        `${dinheiroOrcamento(atual.unitario_centavos)} por unidade`));
      if (salvo.referencia.total_centavos !== atual.total_centavos) {
        dados.append(elemento('p', 'aviso-item-carrinho', 'O preço foi atualizado conforme o catálogo atual.'));
      }
    }
    const botoes = elemento('div', 'acoes-item-carrinho');
    const editar = elemento('button', '', 'Editar configuração');
    editar.type = 'button';
    editar.dataset.editarItem = salvo.id;
    editar.disabled = !atual?.slug;
    editar.setAttribute('aria-label', `Editar configuração de ${atual?.nome || salvo.referencia.nome}`);
    editar.addEventListener('click', () => acoes.editar(salvo, atual, editar));
    const remover = elemento('button', 'remover-item-carrinho', 'Remover');
    remover.type = 'button';
    remover.setAttribute('aria-label', `Remover ${atual?.nome || salvo.referencia.nome} do orçamento`);
    remover.addEventListener('click', () => acoes.remover(salvo));
    botoes.append(editar, remover);
    dados.append(botoes);
    card.append(dados);
    container.append(card);
  }
}
