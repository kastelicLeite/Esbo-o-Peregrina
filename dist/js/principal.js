import { configuracao, produtos, linkWhatsapp } from './configuracao.js';

const lista = document.querySelector('#lista-produtos');
const atalhos = document.querySelector('#atalhos-produtos');

produtos.forEach((produto, indice) => {
  const artigo = document.createElement('article');
  artigo.className = `produto ${produto.classe}`;
  artigo.id = `produto-${produto.classe}`;

  const atalho = document.createElement('a');
  atalho.href = `#${artigo.id}`;
  atalho.textContent = produto.nome;
  atalhos.append(atalho);

  const visual = document.createElement('div');
  visual.className = 'produto-visual';

  if (produto.foto) {
    const imagem = document.createElement('img');
    imagem.src = produto.foto;
    imagem.alt = produto.nome;
    imagem.loading = 'lazy';
    imagem.width = 800;
    imagem.height = 600;
    visual.append(imagem);
  } else {
    visual.setAttribute('role', 'img');
    visual.setAttribute(
      'aria-label',
      `Espaço reservado para foto de ${produto.nome.toLowerCase()}`,
    );

    const numero = document.createElement('span');
    numero.className = 'numero-visual';
    numero.textContent = `0${indice + 1}`;

    const nome = document.createElement('span');
    nome.className = 'nome-visual';
    nome.textContent = produto.nome;

    visual.append(numero, nome);
  }

  const informacoes = document.createElement('div');
  informacoes.className = 'produto-informacoes';

  const titulo = document.createElement('h3');
  titulo.textContent = produto.nome;

  const descricao = document.createElement('p');
  descricao.textContent = produto.descricao;

  const link = document.createElement('a');
  link.className = 'link-texto';
  link.href = linkWhatsapp(produto.nome);
  link.textContent = 'Solicitar orçamento';
  link.setAttribute(
    'aria-label',
    `Solicitar orçamento de ${produto.nome.toLowerCase()} pelo WhatsApp`,
  );

  informacoes.append(titulo, descricao, link);
  artigo.append(visual, informacoes);
  lista.append(artigo);
});

document.querySelectorAll('[data-orcamento]').forEach((link) => {
  link.href = linkWhatsapp();
});

const telefone = document.querySelector('#telefone');
telefone.textContent = configuracao.telefoneExibido;
telefone.href = linkWhatsapp();

if (configuracao.logo) {
  const marca = document.querySelector('.marca');
  const imagem = document.createElement('img');
  imagem.src = configuracao.logo;
  imagem.alt = 'Gráfica Peregrina';
  imagem.width = 2159;
  imagem.height = 640;
  marca.replaceChildren(imagem);
}
