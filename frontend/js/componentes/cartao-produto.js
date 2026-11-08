import { ativarPreviaImagens } from './previa-imagens-cartao.js';

export function formatarDinheiro(centavos) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
}

export function formatarPrecoUnitario(totalCentavos, quantidade) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(totalCentavos / quantidade / 100);
}

export function criarCartaoProduto(produto) {
  const cartao = document.createElement('article');
  cartao.className = 'cartao-catalogo';
  if (produto.imagem) {
    const imagem = document.createElement('img');
    imagem.className = 'imagem-cartao';
    imagem.src = produto.imagem.miniatura;
    imagem.alt = produto.imagem.alternativo?.trim() || produto.nome;
    imagem.width = produto.imagem.largura;
    imagem.height = produto.imagem.altura;
    imagem.loading = 'lazy';
    const linkImagem = document.createElement('a');
    linkImagem.className = 'capa-cartao';
    linkImagem.href = `/paginas/produto.html?produto=${encodeURIComponent(produto.slug)}`;
    linkImagem.append(imagem);
    cartao.append(linkImagem);
    ativarPreviaImagens(cartao, imagem, produto);
  }
  const corpo = document.createElement('div');
  corpo.className = 'corpo-cartao';
  const categoria = document.createElement('p');
  categoria.className = 'categoria-cartao';
  categoria.textContent = produto.categoria;
  const nome = document.createElement('h3');
  const endereco = document.createElement('a');
  endereco.href = `/paginas/produto.html?produto=${encodeURIComponent(produto.slug)}`;
  endereco.textContent = produto.nome;
  nome.append(endereco);
  const descricao = document.createElement('p');
  descricao.className = 'descricao-produto';
  descricao.textContent = produto.descricao;
  const preco = document.createElement('p');
  preco.className = 'preco-produto';
  const rotuloPreco = document.createElement('span');
  rotuloPreco.className = 'rotulo-preco-cartao';
  rotuloPreco.textContent = produto.menor_preco ? 'Preço por unidade' : 'Feito para o seu pedido';
  if (produto.menor_preco && produto.menor_preco.unitario_centavos == null) {
    rotuloPreco.textContent = 'Preço aproximado por unidade';
  }
  preco.textContent = produto.menor_preco
    ? `${produto.menor_preco.unitario_centavos != null
      ? formatarDinheiro(produto.menor_preco.unitario_centavos)
      : formatarPrecoUnitario(produto.menor_preco.total_centavos, produto.menor_preco.quantidade)} / un.` : 'Sob orçamento';
  const quantidade = document.createElement('p');
  quantidade.className = 'resumo-opcoes';
  quantidade.textContent = produto.menor_preco
    ? `No lote de ${new Intl.NumberFormat('pt-BR').format(produto.menor_preco.quantidade)} unidades · ${produto.menor_preco.aproximado ? 'Preço aproximado' : 'Total'}: ${formatarDinheiro(produto.menor_preco.total_centavos)}`
    : 'Consulte opções e quantidades';
  const botao = document.createElement('a');
  botao.className = 'botao ver-opcoes';
  botao.href = endereco.href;
  botao.textContent = 'Ver';
  botao.setAttribute('aria-label', `Ver ${produto.nome}`);
  const rodape = document.createElement('div');
  rodape.className = 'rodape-cartao-produto';
  rodape.append(rotuloPreco, preco, quantidade, botao);
  corpo.append(categoria, nome, descricao, rodape);
  cartao.append(corpo);
  return cartao;
}
