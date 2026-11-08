import '../cabecalho.js';
import { atualizarSite } from '../site-publico.js';
import { carregarSite, configuracao } from '../configuracao.js';
import { abrirDetalhes } from '../detalhes-produto.js';
import { carrinho } from './estado.js';
import { validarItens } from './api.js';
import { mostrarItens } from './itens.js';
import { dinheiroOrcamento, mensagemOrcamento, prepararLinkOrcamento } from './mensagem.js';
import { avisarAcao } from '../componentes/avisos.js';
import { registrarAtividade } from '../historico/cliente.js';

const lista = document.querySelector('#itens-orcamento');
const estado = document.querySelector('#estado-orcamento');
const erro = document.querySelector('#erro-orcamento');
const resumo = document.querySelector('#resumo-carrinho');
const solicitar = document.querySelector('#solicitar-orcamento');
const tentar = document.querySelector('#revalidar-orcamento');
const dialogo = document.querySelector('#mensagem-orcamento');
let validacao;
let sequencia = 0;
let preparando = false;
let focoEditado;

function mostrarErro(texto) {
  erro.textContent = texto;
  erro.hidden = !texto;
}

function desenhar(salvos, dados) {
  validacao = dados;
  mostrarItens(lista, salvos, dados, { editar, remover });
  resumo.hidden = !salvos.length;
  document.querySelector('#contagem-orcamento').textContent = `${salvos.length} ${salvos.length === 1 ? 'configuração' : 'configurações'} · um lote por item`;
  document.querySelector('#rotulo-subtotal').textContent = dados.sob_orcamento || !dados.pode_enviar
    ? 'Subtotal dos itens com preço' : 'Total dos itens';
  if (dados.com_preco) {
    document.querySelector('#rotulo-subtotal').textContent += ' (preço aproximado)';
  }
  document.querySelector('#valor-subtotal').textContent = dados.com_preco ? dinheiroOrcamento(dados.subtotal_centavos) : 'Sob orçamento';
  document.querySelector('#itens-sem-preco').textContent = dados.sob_orcamento
    ? `${dados.sob_orcamento} ${dados.sob_orcamento === 1 ? 'item depende' : 'itens dependem'} de orçamento.` : '';
  solicitar.disabled = !dados.pode_enviar || preparando;
  estado.textContent = salvos.length && !dados.pode_enviar
    ? 'Há itens indisponíveis. Edite ou remova esses itens para continuar.' : '';
  if (focoEditado && !document.querySelector('dialog[open]')) {
    lista.querySelectorAll('[data-editar-item]').forEach((botao) => {
      if (botao.dataset.editarItem === focoEditado) botao.focus();
    });
    focoEditado = null;
  }
}

async function atualizar() {
  const chamada = ++sequencia;
  const salvos = carrinho.ler();
  solicitar.disabled = true;
  lista.setAttribute('aria-busy', 'true');
  estado.textContent = 'Conferindo produtos e preços…';
  tentar.hidden = true;
  try {
    const dados = await validarItens(salvos);
    if (chamada !== sequencia) return;
    mostrarErro('');
    desenhar(salvos, dados);
    if (carrinho.falhaLeitura()) mostrarErro('Não foi possível recuperar o orçamento salvo neste navegador. Confira se o armazenamento está disponível.');
  } catch (falha) {
    if (chamada !== sequencia) return;
    mostrarErro(falha.message);
    estado.textContent = 'Não foi possível conferir o orçamento. Seus itens foram mantidos.';
    tentar.hidden = false;
  } finally {
    if (chamada === sequencia) lista.setAttribute('aria-busy', 'false');
  }
}

function remover(item) {
  try {
    carrinho.remover(item.id);
    avisarAcao('Item removido do carrinho.');
  } catch (falha) { mostrarErro(falha.message); }
}

async function editar(item, atual, botao) {
  botao.disabled = true;
  try {
    const resposta = await fetch(`/api/produtos/${encodeURIComponent(atual.slug)}`, { cache: 'no-store' });
    if (!resposta.ok) throw new Error('Este produto não está disponível. Atualize o orçamento ou remova o item.');
    abrirDetalhes(await resposta.json(), undefined, {
      inicial: item,
      aoSalvar: () => { focoEditado = item.id; atualizar(); },
    });
  } catch (falha) { mostrarErro(falha.message); }
  finally { botao.disabled = false; }
}

document.querySelector('#limpar-orcamento').addEventListener('click', () => {
  if (!confirm('Remover todos os itens do carrinho?')) return;
  try { carrinho.limpar(); avisarAcao('Carrinho limpo.'); } catch (falha) { mostrarErro(falha.message); }
});

solicitar.addEventListener('click', async () => {
  if (preparando) return;
  preparando = true;
  solicitar.disabled = true;
  const textoSolicitar = solicitar.textContent;
  solicitar.textContent = 'Conferindo seu carrinho…';
  solicitar.setAttribute('aria-busy', 'true');
  const salvos = carrinho.ler();
  const anterior = JSON.stringify(validacao);
  try {
    const [dados] = await Promise.all([validarItens(salvos), carregarSite(true)]);
    if (JSON.stringify(salvos) !== JSON.stringify(carrinho.ler())) {
      throw new Error('O orçamento mudou em outra aba. Confira os itens antes de continuar.');
    }
    desenhar(salvos, dados);
    if (!dados.pode_enviar) return;
    if (anterior !== JSON.stringify(dados)) {
      mostrarErro('O catálogo mudou. Confira os valores atualizados e solicite o orçamento novamente.');
      return;
    }
    mostrarErro('');
    const mensagem = mensagemOrcamento(dados);
    const destino = prepararLinkOrcamento(configuracao.whatsapp, mensagem);
    document.querySelector('#resumo-whatsapp').value = mensagem;
    document.querySelector('#abrir-whatsapp').href = destino.link;
    document.querySelector('#instrucoes-mensagem').textContent = destino.precisaCopiar
      ? 'Seu resumo é longo. Copie a mensagem completa, abra o WhatsApp e cole na conversa.'
      : 'Revise os itens. A conversa abrirá com esta mensagem para você conferir e enviar no WhatsApp.';
    document.querySelector('#estado-copia').textContent = '';
    dialogo.showModal();
    registrarAtividade('orcamento', { itens: salvos, resumo: dados });
  } catch (falha) { mostrarErro(falha.message); }
  finally {
    preparando = false;
    solicitar.textContent = textoSolicitar;
    solicitar.removeAttribute('aria-busy');
    solicitar.disabled = !validacao?.pode_enviar;
  }
});

document.querySelector('#copiar-orcamento').addEventListener('click', async () => {
  const mensagem = document.querySelector('#resumo-whatsapp');
  try {
    await navigator.clipboard.writeText(mensagem.value);
    document.querySelector('#estado-copia').textContent = 'Resumo copiado. Cole na conversa do WhatsApp.';
  } catch {
    mensagem.focus();
    mensagem.select();
    document.querySelector('#estado-copia').textContent = 'Selecione e copie o texto acima para colar no WhatsApp.';
  }
});
document.querySelector('#fechar-mensagem').addEventListener('click', () => dialogo.close());
dialogo.addEventListener('close', () => solicitar.focus());
window.addEventListener('orcamento-alterado', () => {
  if (dialogo.open) dialogo.close();
  atualizar();
});
window.addEventListener('pageshow', atualizar);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !dialogo.open) atualizar(); });
tentar.addEventListener('click', atualizar);
atualizarSite().catch((falha) => mostrarErro(falha.message));
atualizar();
