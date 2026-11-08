import './cabecalho.js';
import { atualizarSite } from './site-publico.js';
import { criarCartaoProduto } from './componentes/cartao-produto.js';
import { lerHistorico } from './historico/cliente.js';
import { recomendarProdutos } from './recomendacoes.js';

const lista = document.querySelector('#lista-recomendados');
const estado = document.querySelector('#estado-recomendados');
try {
  await atualizarSite();
  const resposta = await fetch('/api/produtos', { cache: 'no-store' });
  if (!resposta.ok) throw new Error('Não foi possível consultar os produtos.');
  const catalogo = await resposta.json();
  let historico;
  try { historico = await lerHistorico(); }
  catch { estado.textContent = 'Seu histórico não está disponível. Mostramos opções do catálogo.'; }
  const recomendados = recomendarProdutos(catalogo, historico?.eventos || []);
  for (const { produto, motivo } of recomendados) {
    const cartao = criarCartaoProduto(produto);
    const explicacao = document.createElement('p');
    explicacao.className = 'motivo-recomendacao';
    explicacao.textContent = motivo;
    cartao.querySelector('.corpo-cartao').prepend(explicacao);
    lista.append(cartao);
  }
  if (!estado.textContent || estado.textContent === 'Buscando sugestões…') estado.textContent = recomendados.length
    ? historico?.eventos.length ? 'Sugestões com base nas suas pesquisas, visualizações e orçamentos preparados.'
      : 'Comece explorando o catálogo. Suas próximas atividades ajudarão a personalizar as sugestões.' : 'Nenhum produto disponível no momento.';
} catch (erro) {
  estado.textContent = erro.message || 'Não foi possível carregar as recomendações.';
  document.querySelector('#tentar-recomendados').hidden = false;
} finally { lista.setAttribute('aria-busy', 'false'); }
document.querySelector('#tentar-recomendados').addEventListener('click', () => location.reload());
