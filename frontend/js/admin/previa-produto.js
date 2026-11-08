import { abrirDetalhes } from '../detalhes-produto.js';
import { elemento, botao, dialogo } from './interface.js';
import { produtoParaPrevia, selecionarNaPrevia } from './previa-dados.js';
import { preencherPainel } from './previa-painel.js';

export function abrirPreviaEditavel({ ler, aplicar, midias, categorias, salvarRascunho, publicar }) {
  const inicial = structuredClone(ler());
  const estado = { produto: structuredClone(inicial), midias };
  const simulacao = { opcoes: {}, quantidade: null };
  const raiz = elemento('div', { className: 'editor-previa' });
  const area = elemento('div', { className: 'pagina-produto previa-editavel', 'aria-label': 'Prévia do produto' });
  const lateral = elemento('aside', { className: 'painel-previa', 'aria-label': 'Configurações do produto' });
  const conteudo = elemento('div', { className: 'conteudo-painel-previa' });
  const erro = elemento('p', { className: 'erro-formulario', role: 'alert' });
  const status = elemento('p', { className: 'estado-previa', role: 'status' }, 'Alterações guardadas no cadastro, sem publicação automática.');
  const orientacao = elemento('p', { className: 'orientacao-previa' });
  const modo = botao('Simular cliente', alternarModo);
  modo.setAttribute('aria-pressed', 'false');
  const barra = elemento('div', { className: 'barra-previa' }, [orientacao, modo]);
  const corpo = elemento('div', { className: 'corpo-editor-previa' }, [area, lateral]);
  const menu = elemento('nav', { className: 'menu-painel-previa', 'aria-label': 'Seções de edição' });
  lateral.append(elemento('h2', {}, 'Editar cadastro'), menu, erro, conteudo);
  const rodape = elemento('div', { className: 'rodape-previa' });
  raiz.append(barra, corpo, rodape);
  const modal = dialogo('Prévia editável do produto', raiz);
  modal.dialog.classList.add('dialog-previa-produto');
  let artigo;
  let edicao = true;
  let secao = 'apresentacao';
  let selecionado;
  let pendente = false;
  let encerrado = false;
  const secoes = { apresentacao: 'Apresentação', imagens: 'Imagens', caracteristicas: 'Características',
    tiragens: 'Tiragens', precos: 'Preços e compatibilidade' };
  for (const [chave, nome] of Object.entries(secoes)) menu.append(botao(nome, () => abrirPainel(chave)));

  function alterar() {
    if (pendente || encerrado) return;
    pendente = true;
    queueMicrotask(() => {
      pendente = false;
      if (encerrado) return;
      try {
        aplicar(structuredClone(estado.produto));
        desenharProduto();
        erro.textContent = '';
        status.textContent = 'Alterações guardadas no cadastro, sem publicação automática.';
      } catch (falha) { erro.textContent = falha.message; }
    });
  }

  function abrirPainel(chave, id, focar = true) {
    secao = chave;
    selecionado = id;
    for (const [indice, botaoMenu] of [...menu.querySelectorAll('button')].entries()) {
      botaoMenu.setAttribute('aria-current', String(Object.keys(secoes)[indice] === secao));
    }
    preencherPainel({ destino: conteudo, secao, selecionado, estado, categorias, simulacao, alterar });
    if (focar) {
      conteudo.querySelector('details[open] input, input, textarea, select, button')?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 900px)').matches) lateral.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  function alvo(node, chave, id, nome) {
    if (!node || !edicao) return;
    node.classList.add('alvo-edicao-previa');
    node.tabIndex = 0;
    node.setAttribute('aria-label', `Configurar ${nome}`);
    node.title = `Configurar ${nome}`;
    node.querySelectorAll('input, select, button, a').forEach((controle) => {
      controle.inert = true;
      controle.tabIndex = -1;
    });
    const abrir = (evento) => {
      evento.preventDefault();
      evento.stopPropagation();
      abrirPainel(chave, id);
    };
    node.addEventListener('click', abrir, true);
    node.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') abrir(evento);
    });
  }

  function guardarSimulacao() {
    simulacao.opcoes = Object.fromEntries([...artigo.querySelectorAll('.opcao-produto input:checked')]
      .map((input) => [input.name.slice(6), input.value]));
    simulacao.quantidade = Number(artigo.querySelector('[data-quantidade-produto] select')?.value);
  }

  function desenharProduto() {
    const rolagem = area.scrollTop;
    artigo?.dispatchEvent(new Event('close'));
    const produto = produtoParaPrevia(estado.produto, midias, categorias);
    abrirDetalhes(produto, area, { previa: true, inicial: selecionarNaPrevia(produto, simulacao) });
    artigo = area.querySelector('article');
    artigo.addEventListener('change', guardarSimulacao);
    guardarSimulacao();
    alvo(artigo.querySelector('h1'), 'apresentacao', null, 'nome do produto');
    alvo(artigo.querySelector('.categoria-detalhe'), 'apresentacao', null, 'categoria');
    alvo(artigo.querySelector('.descricao-detalhe'), 'apresentacao', null, 'descrição');
    alvo(artigo.querySelector('.fotos-configuracao'), 'imagens', null, 'imagens');
    if (!produto.imagem && !produto.galeria.length) {
      artigo.querySelector('.fotos-configuracao').append(elemento('div', { className: 'imagem-vazia-previa' }, 'Adicionar imagens do produto'));
    }
    for (const campo of artigo.querySelectorAll('[data-caracteristica-produto]')) {
      const id = campo.dataset.caracteristicaProduto;
      const nome = estado.produto.caracteristicas.find((item) => item.id === id)?.nome || 'característica';
      alvo(campo, 'caracteristicas', id, nome);
    }
    alvo(artigo.querySelector('[data-quantidade-produto]'), 'tiragens', null, 'tiragens');
    alvo(artigo.querySelector('.resumo-orcamento'), 'precos', null, 'preços e compatibilidade');
    area.scrollTop = rolagem;
  }

  function atualizarModo() {
    modo.textContent = edicao ? 'Simular cliente' : 'Voltar à edição';
    modo.setAttribute('aria-pressed', String(!edicao));
    orientacao.textContent = edicao
      ? 'Editar cadastro · Clique em uma parte do produto para configurar no painel.'
      : 'Simular cliente · Teste opções e tiragens. Suas escolhas não alteram o cadastro.';
    lateral.hidden = !edicao;
    raiz.classList.toggle('modo-simulacao', !edicao);
  }

  function alternarModo() {
    edicao = !edicao;
    atualizarModo();
    desenharProduto();
  }

  const acoes = elemento('div', { className: 'acoes-linha' });
  const confirmarDescarte = elemento('div', { className: 'confirmacao-descarte-previa', hidden: true,
    role: 'group', 'aria-label': 'Confirmar descarte das alterações' });
  const descartar = botao('Descartar alterações da prévia', () => {
    confirmarDescarte.hidden = false;
    confirmarDescarte.querySelector('button').focus();
  });
  confirmarDescarte.append(elemento('p', {}, 'Descartar as alterações desta prévia e restaurar o preenchimento anterior?'),
    botao('Continuar editando', () => { confirmarDescarte.hidden = true; descartar.focus(); }),
    botao('Sim, descartar', () => {
      estado.produto = structuredClone(inicial);
      aplicar(structuredClone(inicial));
      desenharProduto();
      abrirPainel(secao, selecionado, false);
      confirmarDescarte.hidden = true;
      descartar.focus();
      status.textContent = 'Alterações da prévia descartadas. O preenchimento anterior foi restaurado.';
    }));
  acoes.append(descartar);
  function concluir(acao) {
    aplicar(structuredClone(estado.produto));
    modal.dialog.close();
    acao?.();
  }
  acoes.append(botao('Voltar ao cadastro', () => concluir()));
  if (salvarRascunho) acoes.append(botao('Salvar rascunho', () => concluir(salvarRascunho)));
  if (publicar) acoes.append(botao('Publicar', () => concluir(publicar), 'botao'));
  rodape.append(status, confirmarDescarte, acoes);
  conteudo.addEventListener('click', (evento) => {
    const botaoAtual = evento.target.closest('button');
    if (!botaoAtual) return;
    const nome = botaoAtual.textContent;
    const iguais = [...conteudo.querySelectorAll('button')].filter((item) => item.textContent === nome);
    const indice = iguais.indexOf(botaoAtual);
    requestAnimationFrame(() => {
      const focoPerdido = document.activeElement === document.body || document.activeElement === modal.dialog;
      if (encerrado || botaoAtual.isConnected || !focoPerdido) return;
      const novos = [...conteudo.querySelectorAll('button')].filter((item) => item.textContent === nome);
      novos[Math.min(indice, novos.length - 1)]?.focus({ preventScroll: true });
    });
  }, true);
  for (const evento of ['input', 'change', 'click']) conteudo.addEventListener(evento, alterar);
  modal.dialog.addEventListener('close', () => {
    encerrado = true;
    artigo?.dispatchEvent(new Event('close'));
  }, { once: true });
  atualizarModo();
  desenharProduto();
  abrirPainel(secao, null, false);
}
