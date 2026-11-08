import '../componentes/conta-cabecalho.js';
import { lerHistorico, limparHistorico, configurarHistorico } from './cliente.js';

const lista = document.querySelector('#lista-historico');
const estado = document.querySelector('#estado-historico');
const pausar = document.querySelector('#pausar-historico');
const limpar = document.querySelector('#limpar-historico');
let dados;
let tipo = 'todos';
const criar = (tag, texto, classe) => {
  const elemento = document.createElement(tag);
  if (texto) elemento.textContent = texto;
  if (classe) elemento.className = classe;
  return elemento;
};
const dinheiro = valor => Number.isSafeInteger(valor) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor / 100) : 'Sob orçamento';

function desenhar() {
  lista.replaceChildren();
  const eventos = dados.eventos.filter(item => tipo === 'todos' || item.tipo === tipo);
  document.querySelector('#origem-historico').textContent = dados.origem === 'conta'
    ? 'Histórico da sua conta, disponível também nos outros dispositivos em que você entrar.'
    : 'Histórico deste navegador. Entre na sua conta para registrar as próximas atividades na conta. Os dados de visitante não são transferidos automaticamente.';
  estado.textContent = dados.falha ? 'Algumas atividades não puderam ser guardadas. Confira o armazenamento do navegador.'
    : `${eventos.length} ${eventos.length === 1 ? 'registro' : 'registros'}. ${dados.ativo ? 'Histórico ativo.' : 'Novos registros pausados.'}`;
  pausar.textContent = dados.ativo ? 'Pausar histórico' : 'Retomar histórico';
  pausar.disabled = false;
  limpar.disabled = eventos.length === 0 && !dados.falha;
  limpar.textContent = tipo === 'todos' ? 'Limpar todo o histórico' : 'Limpar esta categoria';
  if (!eventos.length) lista.append(criar('p', 'Nenhuma atividade guardada nesta categoria.', 'historico-vazio'));
  for (const evento of eventos) {
    const cartao = criar('article', '', 'registro-historico');
    const data = criar('time', new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(evento.criado_em));
    data.dateTime = new Date(evento.criado_em).toISOString();
    const rotulos = { pesquisa: 'Pesquisa', visualizacao: 'Produto visualizado', orcamento: 'Orçamento preparado' };
    cartao.append(criar('p', rotulos[evento.tipo], 'historico-tipo'), data);
    const conteudo = evento.dados;
    if (evento.tipo === 'pesquisa' || evento.tipo === 'visualizacao') {
      const link = criar('a', evento.tipo === 'pesquisa' ? String(conteudo.termo || '') : String(conteudo.nome || 'Produto'));
      link.href = evento.tipo === 'pesquisa' ? `/paginas/produtos.html?q=${encodeURIComponent(conteudo.termo || '')}`
        : `/paginas/produto.html?produto=${encodeURIComponent(conteudo.slug || '')}`;
      const titulo = criar('h2');
      titulo.append(link);
      cartao.append(titulo);
    } else {
      cartao.append(criar('h2', 'Resumo do orçamento'));
      for (const item of Array.isArray(conteudo.itens) ? conteudo.itens : []) {
        const detalhe = criar('div', '', 'item-historico-orcamento');
        detalhe.append(criar('h3', `${item.nome} · ${Number(item.quantidade).toLocaleString('pt-BR')} unidades`));
        detalhe.append(criar('p', (item.especificacoes || []).map(campo => `${campo.nome}: ${campo.valor}`).join(' · ')));
        detalhe.append(criar('p', `Valor de referência: ${dinheiro(item.total_centavos)}`));
        cartao.append(detalhe);
      }
      cartao.append(criar('p', `Total dos itens com preço: ${dinheiro(conteudo.subtotal_centavos)}`),
        criar('p', 'Registro de preparo. Não confirma envio, pedido, pagamento ou aprovação do orçamento. Valores e disponibilidade podem mudar.', 'historico-nota'));
    }
    lista.append(cartao);
  }
}

async function carregar() {
  estado.textContent = 'Carregando seu histórico…';
  try { dados = await lerHistorico(); desenhar(); }
  catch (erro) {
    estado.textContent = erro.message;
    document.querySelector('#tentar-historico').hidden = false;
  }
}
document.querySelectorAll('[data-tipo-historico]').forEach(botao => botao.addEventListener('click', () => {
  tipo = botao.dataset.tipoHistorico;
  document.querySelectorAll('[data-tipo-historico]').forEach(item => item.setAttribute('aria-pressed', String(item === botao)));
  if (dados) desenhar();
}));
pausar.addEventListener('click', async () => {
  pausar.disabled = true;
  try { await configurarHistorico(!dados.ativo); await carregar(); }
  catch (erro) { estado.textContent = erro.message; }
  finally { pausar.disabled = false; }
});
limpar.addEventListener('click', async () => {
  if (!confirm('Remover os registros selecionados do histórico? O carrinho não será alterado.')) return;
  limpar.disabled = true;
  try { await limparHistorico(tipo === 'todos' ? undefined : tipo); await carregar(); }
  catch (erro) { estado.textContent = erro.message; limpar.disabled = false; }
});
document.querySelector('#tentar-historico').addEventListener('click', () => location.reload());
carregar();
