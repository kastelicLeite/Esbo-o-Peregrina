import { montarGaleria } from './galeria-produto.js';
import { linkWhatsapp } from './configuracao.js';
import { carrinho } from './orcamento/estado.js';
import { validarItens } from './orcamento/api.js';
import { avisarAcao } from './componentes/avisos.js';
import { registrarAtividade } from './historico/cliente.js';

const dinheiro = (valor) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 2,
}).format(valor / 100);

function criar(tag, classe, texto) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}

export function abrirDetalhes(produto, destino, configuracao = {}) {
  const origem = document.activeElement;
  if (!configuracao.previa && !location.pathname.includes('painel-admin')) registrarAtividade('visualizacao', { produto });
  const dialog = criar(destino ? 'article' : 'dialog', 'detalhes-produto');
  const tituloId = `produto-${produto.id}-${crypto.randomUUID()}`;
  dialog.setAttribute('aria-labelledby', tituloId);
  const topo = criar('div', 'topo-detalhes');
  const titulo = criar(destino ? 'h1' : 'h2', '', produto.nome);
  titulo.id = tituloId;
  const fechar = criar('button', 'botao-admin', 'Fechar');
  fechar.type = 'button';
  fechar.addEventListener('click', () => dialog.close());
  topo.append(titulo);
  if (!destino) topo.append(fechar);
  const corpo = criar('div', 'corpo-detalhes');
  const galeria = criar('div', 'galeria-produto');
  const imagens = [produto.imagem, ...produto.galeria].filter(Boolean)
    .filter((item, indice, lista) => lista.findIndex((outro) => outro.id === item.id) === indice);
  const fotos = criar('div', 'fotos-configuracao');
  galeria.append(fotos);
  let limparGaleria = montarGaleria(fotos, imagens);
  let chaveFotos = '';
  dialog.addEventListener('close', () => limparGaleria(), { once: true });
  const informacoes = criar('div', 'informacoes-detalhes');
  if (destino) {
    informacoes.append(criar('p', 'categoria-detalhe', produto.categoria), topo);
  }
  informacoes.append(criar('p', 'descricao-detalhe', produto.descricao));
  const fixas = criar('dl', 'caracteristicas-fixas');
  const detalhesSelecionados = [];
  produto.caracteristicas.filter((item) => item.tipo === 'fixa'
    || ['tamanho', 'material', 'acabamento'].includes(item.nome.trim().toLocaleLowerCase('pt-BR'))).forEach((item) => {
    const linha = criar('div');
    linha.dataset.caracteristicaProduto = item.id;
    const valor = criar('dd', '', item.tipo === 'fixa' ? item.valor : 'Selecione uma opção');
    if (item.tipo === 'selecao') detalhesSelecionados.push({ item, valor });
    linha.append(criar('dt', '', item.nome), valor);
    fixas.append(linha);
  });
  if (destino && fixas.childElementCount) {
    const especificacoes = criar('section', 'especificacoes-produto');
    especificacoes.append(criar('h2', '', 'Detalhes do produto'), fixas);
    galeria.append(especificacoes);
  } else {
    informacoes.append(fixas);
  }
  const selecoes = {};
  const seletores = [];
  for (const item of produto.caracteristicas.filter((campo) => campo.tipo === 'selecao')) {
    const campo = criar('div', 'campo-detalhe');
    campo.dataset.caracteristicaProduto = item.id;
    const label = criar('label', '', item.nome);
    const select = criar('select');
    select.id = `escolha-${crypto.randomUUID()}`;
    label.htmlFor = select.id;
    const vazio = criar('option', '', 'Selecione');
    vazio.value = '';
    select.append(vazio);
    item.valores.forEach((valor) => {
      const opcao = criar('option', '', valor.nome);
      opcao.value = valor.id;
      select.append(opcao);
    });
    select.addEventListener('change', () => {
      if (select.value) selecoes[item.id] = select.value;
      else delete selecoes[item.id];
      ajustarSelecoes(item.id);
      atualizarQuantidades();
    });
    seletores.push({ item, select });
    if (destino) {
      const grupo = criar('fieldset', 'opcoes-produto');
      grupo.append(criar('legend', '', item.nome));
      for (const valor of item.valores) {
        const escolha = criar('label', 'opcao-produto');
        const radio = criar('input');
        radio.type = 'radio';
        radio.name = `opcao-${item.id}`;
        radio.value = valor.id;
        const ajuda = criar('span', 'somente-leitor');
        ajuda.id = `compatibilidade-${crypto.randomUUID()}`;
        radio.setAttribute('aria-describedby', ajuda.id);
        radio.addEventListener('change', () => {
          selecoes[item.id] = valor.id;
          select.value = valor.id;
          ajustarSelecoes(item.id);
          atualizarQuantidades();
        });
        escolha.append(radio, criar('span', '', valor.nome), ajuda);
        grupo.append(escolha);
      }
      campo.append(grupo);
    } else {
      campo.append(label, select);
    }
    informacoes.append(campo);
  }
  const campoQuantidade = criar('div', 'campo-detalhe');
  campoQuantidade.dataset.quantidadeProduto = '';
  const rotulo = criar('label', '', 'Quantidade');
  const quantidade = criar('select');
  quantidade.id = `quantidade-${crypto.randomUUID()}`;
  rotulo.htmlFor = quantidade.id;
  campoQuantidade.append(rotulo, quantidade);
  const campoPersonalizado = criar('div', 'quantidade-personalizada');
  campoPersonalizado.hidden = true;
  const rotuloPersonalizado = criar('label', '', 'Digite a quantidade de unidades');
  const personalizada = criar('input');
  personalizada.id = `quantidade-livre-${crypto.randomUUID()}`;
  personalizada.type = 'number';
  personalizada.min = '1';
  personalizada.max = '10000000';
  personalizada.step = '1';
  personalizada.inputMode = 'numeric';
  personalizada.placeholder = 'Ex.: 750';
  rotuloPersonalizado.htmlFor = personalizada.id;
  const ajudaQuantidade = criar('p', 'ajuda-quantidade',
    'Quantidades sem preço cadastrado serão confirmadas pela equipe no orçamento.');
  ajudaQuantidade.id = `ajuda-quantidade-${crypto.randomUUID()}`;
  personalizada.setAttribute('aria-describedby', ajudaQuantidade.id);
  quantidade.setAttribute('aria-describedby', ajudaQuantidade.id);
  campoPersonalizado.append(rotuloPersonalizado, personalizada);
  campoQuantidade.append(campoPersonalizado, ajudaQuantidade);
  const estado = criar('p', 'preco-detalhe');
  estado.setAttribute('role', 'status');
  const unitario = criar('p', 'unitario-detalhe');
  const solicitar = criar('a', 'botao', 'Fazer orçamento pelo WhatsApp');
  solicitar.classList.add('orcamento-direto');
  solicitar.setAttribute('aria-disabled', 'true');
  solicitar.addEventListener('click', (evento) => {
    if (!solicitar.hasAttribute('href')) evento.preventDefault();
    else if (configuracao.previa) {
      evento.preventDefault();
      avisoCarrinho.textContent = 'Simulação: este botão abre o orçamento deste produto pelo WhatsApp na página pública.';
    } else {
      const unidades = Number(quantidade.value === 'personalizada' ? personalizada.value : quantidade.value);
      const variacao = candidatas().find(item => item.quantidade === unidades);
      const item = { produto_id: produto.id, opcoes: { ...selecoes }, quantidade: unidades };
      const especificacoes = produto.caracteristicas.map(campo => ({ nome: campo.nome,
        valor: campo.tipo === 'fixa' ? campo.valor : campo.valores.find(valor => valor.id === selecoes[campo.id])?.nome || '' }));
      registrarAtividade('orcamento', { origem: 'produto', itens: [item], resumo: {
        pode_enviar: true, subtotal_centavos: variacao?.total_centavos || 0, sob_orcamento: variacao?.total_centavos ? 0 : 1,
        itens: [{ ...item, nome: produto.nome, slug: produto.slug, especificacoes,
          total_centavos: variacao?.total_centavos ?? null, aproximado: Boolean(variacao?.aproximado) }],
      } });
    }
  });
  const resumo = criar('div', 'resumo-orcamento');
  const adicionar = criar('button', 'botao adicionar-orcamento',
    configuracao.inicial && !configuracao.previa ? 'Salvar configuração' : 'Adicionar ao carrinho');
  adicionar.type = 'button';
  adicionar.disabled = true;
  const avisoCarrinho = criar('p', 'aviso-item-orcamento');
  avisoCarrinho.setAttribute('role', 'status');
  const verCarrinho = criar('a', 'link-texto', 'Ver meu carrinho');
  verCarrinho.href = '/paginas/orcamento.html';
  let enviandoItem = false;
  adicionar.addEventListener('click', async () => {
    if (configuracao.previa) {
      avisoCarrinho.textContent = 'Simulação: produto adicionado ao carrinho. O carrinho real não foi alterado.';
      return;
    }
    if (enviandoItem) return;
    enviandoItem = true;
    adicionar.disabled = true;
    const textoBotao = adicionar.textContent;
    adicionar.textContent = configuracao.inicial ? 'Salvando…' : 'Adicionando…';
    adicionar.setAttribute('aria-busy', 'true');
    avisoCarrinho.dataset.tipo = 'carregando';
    avisoCarrinho.textContent = 'Conferindo opções e preço…';
    try {
      const item = {
        id: configuracao.inicial?.id || crypto.randomUUID(), produto_id: produto.id,
        opcoes: { ...selecoes }, quantidade: Number(quantidade.value === 'personalizada' ? personalizada.value : quantidade.value),
      };
      const dados = await validarItens([item]);
      const conferido = dados.itens[0];
      if (!conferido?.disponivel) throw new Error(conferido?.motivo || 'Confira a configuração escolhida.');
      const resultado = carrinho.adicionar({ ...item, referencia: {
        nome: conferido.nome, imagem: conferido.imagem?.miniatura || '', total_centavos: conferido.total_centavos,
      } }, configuracao.inicial?.id);
      avisoCarrinho.textContent = resultado.duplicado
        ? 'Esta configuração já está no seu carrinho.'
        : configuracao.inicial ? 'Configuração atualizada no carrinho.' : 'Produto adicionado ao carrinho!';
      avisoCarrinho.dataset.tipo = 'sucesso';
      avisarAcao(avisoCarrinho.textContent, { carrinho: true });
      if (configuracao.aoSalvar) {
        configuracao.aoSalvar();
        dialog.close();
      }
    } catch (erro) {
      avisoCarrinho.textContent = erro.message;
      avisoCarrinho.dataset.tipo = 'erro';
      avisarAcao(erro.message, { erro: true });
    } finally {
      enviandoItem = false;
      adicionar.textContent = textoBotao;
      adicionar.removeAttribute('aria-busy');
      atualizarResumo();
    }
  });
  resumo.append(criar('p', 'rotulo-total', 'Seu orçamento'), estado, unitario, adicionar, avisoCarrinho, verCarrinho);
  if (configuracao.previa) {
    verCarrinho.hidden = true;
  }
  if (!configuracao.inicial || configuracao.previa) adicionar.before(solicitar);
  informacoes.append(campoQuantidade, resumo);
  if (destino) {
    informacoes.append(criar('p', 'nota-produto',
      'Precisa de outra quantidade ou acabamento? Converse com a equipe pelo WhatsApp do site.'));
  }

  function candidatas() {
    return produto.variacoes.filter((variacao) => Object.entries(selecoes)
      .every(([chave, valor]) => variacao.opcoes[chave] === valor));
  }
  function ajustarSelecoes(chave) {
    if (!selecoes[chave] || candidatas().length) return;
    const alternativas = produto.variacoes.filter((item) => item.opcoes[chave] === selecoes[chave]);
    alternativas.sort((a, b) => {
      const pontos = (item) => Object.entries(selecoes).filter(([id, valor]) => item.opcoes[id] === valor).length;
      return pontos(b) - pontos(a);
    });
    if (alternativas[0]) Object.assign(selecoes, alternativas[0].opcoes);
  }
  function atualizarCompatibilidade() {
    for (const { item, select } of seletores) {
      select.value = selecoes[item.id] || '';
      for (const opcao of select.options) {
        if (!opcao.value) continue;
        opcao.disabled = !produto.variacoes.some((v) => v.opcoes[item.id] === opcao.value);
      }
      informacoes.querySelectorAll('.opcao-produto input').forEach((radio) => {
        if (radio.name !== `opcao-${item.id}`) return;
        const existe = produto.variacoes.some((v) => v.opcoes[item.id] === radio.value);
        const compativel = produto.variacoes.some((v) => v.opcoes[item.id] === radio.value
          && Object.entries(selecoes).every(([id, valor]) => id === item.id || v.opcoes[id] === valor));
        radio.disabled = !existe;
        radio.checked = selecoes[item.id] === radio.value;
        radio.parentElement.classList.toggle('opcao-incompativel', !compativel);
        radio.parentElement.title = !existe ? 'Combinação ainda não cadastrada'
          : !compativel ? 'Ao selecionar, as outras opções serão ajustadas para uma combinação compatível.' : '';
        radio.parentElement.querySelector('.somente-leitor').textContent = radio.parentElement.title;
      });
    }
  }
  function atualizarQuantidades() {
    atualizarCompatibilidade();
    const anterior = quantidade.value;
    quantidade.replaceChildren();
    const completa = seletores.every(({ item }) => selecoes[item.id]);
    const disponiveis = new Set(candidatas().map((item) => item.quantidade));
    const valores = completa ? produto.tiragens.filter((valor) => disponiveis.has(valor)) : [];
    const vazio = criar('option', '', completa ? 'Selecione a quantidade' : 'Selecione as opções primeiro');
    vazio.value = '';
    quantidade.append(vazio);
    valores.forEach((valor) => {
      const opcao = criar('option', '', `${new Intl.NumberFormat('pt-BR').format(valor)} unidades`);
      opcao.value = String(valor);
      quantidade.append(opcao);
    });
    if (completa) {
      const livre = criar('option', '', 'Outra quantidade — digitar');
      livre.value = 'personalizada';
      quantidade.append(livre);
    }
    if (anterior === 'personalizada' && completa) quantidade.value = anterior;
    else if (valores.includes(Number(anterior))) quantidade.value = anterior;
    else if (valores.length) quantidade.value = String(valores[0]);
    atualizarResumo();
  }
  function atualizarResumo() {
    const vinculadas = produto.caracteristicas.flatMap((campo) => campo.valores
      .filter((valor) => valor.id === selecoes[campo.id] && valor.imagem).map((valor) => valor.imagem));
    const novaChave = vinculadas.map((imagem) => imagem.id).join(',');
    if (novaChave !== chaveFotos) {
      limparGaleria();
      fotos.replaceChildren();
      limparGaleria = montarGaleria(fotos, vinculadas.length ? vinculadas : imagens);
      chaveFotos = novaChave;
    }
    for (const { item, valor } of detalhesSelecionados) {
      valor.textContent = item.valores.find((opcao) => opcao.id === selecoes[item.id])?.nome
        || 'Selecione uma opção';
    }
    adicionar.disabled = true;
    solicitar.removeAttribute('href');
    solicitar.setAttribute('aria-disabled', 'true');
    unitario.textContent = '';
    const livre = quantidade.value === 'personalizada';
    campoPersonalizado.hidden = !livre;
    const unidades = Number(livre ? personalizada.value : quantidade.value);
    const completa = seletores.every(({ item }) => selecoes[item.id]);
    if (!completa || !candidatas().length) {
      estado.textContent = completa && !candidatas().length
        ? 'Esta combinação não está disponível. Escolha outras opções.'
        : 'Selecione as opções e a quantidade para continuar.';
      return;
    }
    if (!Number.isSafeInteger(unidades) || unidades < 1 || unidades > 10000000) {
      estado.textContent = livre
        ? 'Digite uma quantidade inteira entre 1 e 10.000.000.'
        : 'Selecione a quantidade para continuar.';
      return;
    }
    const variacao = candidatas().find((item) => item.quantidade === unidades);
    estado.textContent = variacao?.total_centavos
      ? `${variacao.aproximado ? 'Preço aproximado' : 'Total'}: ${dinheiro(variacao.total_centavos)}` : 'Valor sob orçamento';
    if (variacao?.unitario_centavos != null) {
      unitario.textContent = `Por unidade: ${dinheiro(variacao.unitario_centavos)}`;
    } else if (variacao?.total_centavos) {
      const total = BigInt(variacao.total_centavos) * 100n;
      const divisor = BigInt(variacao.quantidade);
      const valor = Number((total + divisor / 2n) / divisor) / 10000;
      unitario.textContent = `Preço aproximado por unidade: ${new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4,
      }).format(valor)}`;
    }
    const escolhas = produto.caracteristicas.filter((item) => item.tipo === 'fixa')
      .map((item) => `${item.nome}: ${item.valor}`);
    escolhas.push(...seletores.map(({ item }) =>
      `${item.nome}: ${item.valores.find((valor) => valor.id === selecoes[item.id]).nome}`));
    solicitar.href = linkWhatsapp(produto.nome, escolhas, unidades);
    solicitar.removeAttribute('aria-disabled');
    adicionar.disabled = enviandoItem || !produto.tiragens.includes(unidades);
    if (!produto.tiragens.includes(unidades)) {
      avisoCarrinho.textContent = 'Para adicionar ao carrinho, escolha uma das quantidades disponíveis. Para outra quantidade, consulte pelo WhatsApp.';
    }
  }
  quantidade.addEventListener('change', () => {
    atualizarResumo();
    if (quantidade.value === 'personalizada') personalizada.focus();
  });
  personalizada.addEventListener('input', atualizarResumo);
  if ((destino || configuracao.inicial) && produto.variacoes.length) {
    const inicial = configuracao.inicial || produto.variacoes.find((item) => item.total_centavos === produto.menor_preco?.total_centavos)
      || produto.variacoes[0];
    for (const { item, select } of seletores) {
      const valor = inicial.opcoes[item.id];
      if (!valor) continue;
      selecoes[item.id] = valor;
      select.value = valor;
      informacoes.querySelectorAll('.opcao-produto input').forEach((radio) => {
        if (radio.name === `opcao-${item.id}`) radio.checked = radio.value === valor;
      });
    }
    // A tiragem inicial é escolhida após preencher as opções disponíveis.
    atualizarQuantidades();
    quantidade.value = String(inicial.quantidade);
  }
  atualizarQuantidades();
  corpo.append(galeria, informacoes);
  if (destino) dialog.append(corpo);
  else dialog.append(topo, corpo);
  if (destino) {
    destino.replaceChildren(dialog);
  } else {
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (origem?.isConnected && !origem.disabled) origem.focus({ preventScroll: true });
    }, { once: true });
    dialog.showModal();
  }
}
