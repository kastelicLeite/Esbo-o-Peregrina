import './cabecalho.js';
import { atualizarSite } from './site-publico.js';
import { abrirDetalhes } from './detalhes-produto.js';
import { criarCartaoProduto } from './componentes/cartao-produto.js';
import { selecionarRelacionados } from './produtos-relacionados.js';

const destino = document.querySelector('#produto-detalhe');

async function carregarRelacionados(produto) {
  const secao = document.querySelector('#produtos-relacionados');
  try {
    const resposta = await fetch('/api/produtos', { cache: 'no-store' });
    if (!resposta.ok) return;
    const relacionados = selecionarRelacionados(produto, await resposta.json());
    document.querySelector('#lista-relacionados').replaceChildren(...relacionados.map(criarCartaoProduto));
    secao.hidden = relacionados.length === 0;
  } catch {
    secao.hidden = true;
  }
}

try {
  await atualizarSite();
  const slug = location.pathname.startsWith('/produtos/')
    ? decodeURIComponent(location.pathname.slice('/produtos/'.length))
    : new URLSearchParams(location.search).get('produto');
  if (!slug) throw new Error('Escolha um produto no catálogo.');
  const resposta = await fetch(`/api/produtos/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (!resposta.ok) throw new Error('Este produto não está disponível. Volte ao catálogo para consultar os materiais.');
  const produto = await resposta.json();
  document.title = `${produto.nome} | Gráfica Peregrina`;
  const caminho = document.querySelector('.caminho-produto');
  const separador = document.createElement('span');
  separador.setAttribute('aria-hidden', 'true');
  separador.textContent = '/';
  const atual = document.createElement('span');
  atual.textContent = produto.nome;
  atual.setAttribute('aria-current', 'page');
  caminho.append(separador, atual);
  abrirDetalhes(produto, destino);
  carregarRelacionados(produto);
} catch (erro) {
  destino.textContent = erro.message || 'Não foi possível carregar este produto. Tente novamente.';
  destino.setAttribute('role', 'alert');
  const tentar = document.createElement('button');
  tentar.type = 'button';
  tentar.className = 'botao-secundario';
  tentar.textContent = 'Tentar novamente';
  tentar.addEventListener('click', () => location.reload());
  destino.append(document.createElement('br'), tentar);
} finally {
  destino.setAttribute('aria-busy', 'false');
}
