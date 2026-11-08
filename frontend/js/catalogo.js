import './cabecalho.js';
import './visualizacao-catalogo.js';
import { atualizarSite } from './site-publico.js';
import { criarCartaoProduto } from './componentes/cartao-produto.js';
import { abrirDetalhes } from './detalhes-produto.js';
import { pesquisarProdutos, normalizarPesquisa } from './pesquisa-produtos.js';
import { filtrarCatalogo, valoresCaracteristica, precoUnitario } from './filtros-catalogo.js';
import { registrarAtividade } from './historico/cliente.js';
import { prepararEdicaoRapida } from './edicao-rapida-catalogo.js';

const lista = document.querySelector('#catalogo-produtos');
const estado = document.querySelector('#estado-catalogo');
const tentar = document.querySelector('#recarregar-catalogo');
const busca = document.querySelector('#pesquisa-cabecalho');
const categoria = document.querySelector('#categoria-catalogo');
const ordem = document.querySelector('#ordem-catalogo');
const material = document.querySelector('#material-catalogo');
const acabamento = document.querySelector('#acabamento-catalogo');
const minimo = document.querySelector('#preco-minimo-catalogo');
const maximo = document.querySelector('#preco-maximo-catalogo');
const tipo = document.querySelector('#tipo-preco-catalogo');
const formulario = document.querySelector('.filtros-catalogo');
const parametros = new URLSearchParams(location.search);
if (['preco', 'orcamento'].includes(parametros.get('tipo'))) tipo.value = parametros.get('tipo');
busca.value = (parametros.get('q') || '').slice(0, 180);
let produtos = [];
let adicionarEdicao = () => {};

function desenhar() {
  const filtrados = filtrarCatalogo(pesquisarProdutos(produtos, busca.value), {
    categoria: categoria.value, material: material.value, acabamento: acabamento.value,
    minimo: minimo.value, maximo: maximo.value, tipo: tipo.value,
  });
  if (ordem.value === 'nome') filtrados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (ordem.value.startsWith('preco')) filtrados.sort((a, b) => {
    const valorA = precoUnitario(a);
    const valorB = precoUnitario(b);
    if (valorA === null) return valorB === null ? 0 : 1;
    if (valorB === null) return -1;
    return ordem.value === 'preco-desc' ? valorB - valorA : valorA - valorB;
  });
  lista.replaceChildren(...filtrados.map((produto) => {
    const cartao = criarCartaoProduto(produto);
    if (!parametros.has('previa')) adicionarEdicao(cartao, produto);
    return cartao;
  }));
  estado.textContent = filtrados.length ? `${filtrados.length} ${filtrados.length === 1 ? 'produto' : 'produtos'}.`
    : 'Nenhum produto disponível para esta consulta. Fale com a Peregrina para conhecer os materiais.';
}

async function carregar() {
  lista.setAttribute('aria-busy', 'true');
  estado.textContent = 'Carregando produtos…';
  tentar.hidden = true;
  try {
    await atualizarSite();
    const previa = parametros.get('previa');
    const [resposta, respostaCategorias] = await Promise.all([
      fetch(previa ? `/api/admin/produtos/${encodeURIComponent(previa)}/previa` : '/api/produtos', { cache: 'no-store' }),
      fetch('/api/categorias', { cache: 'no-store' }),
    ]);
    if (!resposta.ok || !respostaCategorias.ok) throw new Error('Não foi possível consultar.');
    const dados = await resposta.json();
    produtos = previa ? [dados] : dados;
    adicionarEdicao = await prepararEdicaoRapida();
    const categoriasComProdutos = new Set(produtos.map((produto) => String(produto.categoria_id)));
    categoria.replaceChildren(new Option('Todas as categorias', ''));
    const categorias = await respostaCategorias.json();
    categorias
      .filter((item) => categoriasComProdutos.has(String(item.id)))
      .forEach((item) => categoria.add(new Option(item.nome, String(item.id))));
    const categoriaSolicitada = categorias.find((item) =>
      String(item.id) === parametros.get('categoria') || item.slug === parametros.get('categoria'));
    if (categoriaSolicitada && categoriasComProdutos.has(String(categoriaSolicitada.id))) {
      categoria.value = String(categoriaSolicitada.id);
    }
    for (const [seletor, nome, todos] of [[material, 'material', 'Todos os materiais'], [acabamento, 'acabamento', 'Todos os acabamentos']]) {
      const anterior = seletor.value;
      const valores = new Map();
      produtos.flatMap((item) => valoresCaracteristica(item, nome)).forEach((valor) => valores.set(normalizarPesquisa(valor), valor));
      seletor.replaceChildren(new Option(todos, ''));
      [...valores.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
        .forEach(([valor, rotulo]) => seletor.add(new Option(rotulo, valor)));
      if (valores.has(anterior)) seletor.value = anterior;
    }
    if (previa) {
      const aviso = document.createElement('p');
      aviso.className = 'aviso-previa';
      aviso.textContent = 'Prévia administrativa — esta versão ainda pode não estar publicada.';
      lista.before(aviso);
    }
    desenhar();
    if (!previa && busca.value.trim().length >= 2) registrarAtividade('pesquisa', { termo: busca.value });
    const selecionado = location.pathname.startsWith('/produtos/')
      ? decodeURIComponent(location.pathname.slice('/produtos/'.length)) : parametros.get('produto');
    const produto = produtos.find((item) => item.slug === selecionado);
    if (produto) abrirDetalhes(produto);
    else if (selecionado) estado.textContent = 'Este produto não está disponível no catálogo.';
  } catch {
    estado.textContent = 'Não foi possível carregar o catálogo. Tente novamente.';
    tentar.hidden = false;
  } finally {
    lista.setAttribute('aria-busy', 'false');
  }
}

busca.addEventListener('input', desenhar);
let pesquisaPendente;
busca.addEventListener('input', () => {
  clearTimeout(pesquisaPendente);
  if (parametros.has('previa')) return;
  pesquisaPendente = setTimeout(() => registrarAtividade('pesquisa', { termo: busca.value }), 1200);
});
formulario.addEventListener('input', desenhar);
formulario.addEventListener('change', desenhar);
document.querySelector('#limpar-filtros-catalogo').addEventListener('click', () => {
  formulario.reset();
  busca.value = '';
  const url = new URL(location.href);
  url.searchParams.delete('q');
  url.searchParams.delete('categoria');
  url.searchParams.delete('tipo');
  history.replaceState(null, '', url);
  desenhar();
});
const telaPequena = window.matchMedia('(max-width: 760px)');
const painel = document.querySelector('.painel-filtros');
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--altura-filtros', `${painel.offsetHeight}px`);
}).observe(painel);
painel.open = !telaPequena.matches;
telaPequena.addEventListener('change', (evento) => { painel.open = !evento.matches; });
document.querySelector('.filtros-catalogo').addEventListener('submit', (evento) => {
  evento.preventDefault();
  desenhar();
});
tentar.addEventListener('click', carregar);
carregar();
