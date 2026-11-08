import { requisitar, usuarioAtual } from './api.js';
import { elemento, campo, controlar, botao, dialogo, enviar, mover, avisar } from './interface.js';
import { selecionarMidia } from './midias.js';
import { editorCaracteristicas } from './caracteristicas.js';
import { editorVariacoes } from './variacoes.js';
import { criarRascunhoProduto } from './rascunho-produto.js';
import { abrirPreviaEditavel } from './previa-produto.js';

export async function abrirEditor(id, aoSalvar) {
  let [produto, categorias, midias] = await Promise.all([
    id ? requisitar(`/api/admin/produtos/${id}`) : Promise.resolve({
      nome: '', slug: '', descricao: '', estado: 'rascunho', categoria_id: '', destaque: false,
      posicao: 0, comercial: 'orcamento', estoque: null, imagem_id: '', galeria: [], caracteristicas: [], tiragens: [], variacoes: [],
    }),
    requisitar('/api/admin/categorias'), requisitar('/api/admin/midias'),
  ]);
  let baseProduto = structuredClone(produto);
  let armazenamento;
  try { armazenamento = window.localStorage; } catch {}
  let rascunho = criarRascunhoProduto(armazenamento, usuarioAtual()?.id, id);
  const recuperado = rascunho.ler();
  let restaurado = false;
  if (recuperado && (!id || recuperado.baseAtualizado === produto.atualizado_em
    || confirm('Há um cadastro não concluído neste navegador, mas o produto foi atualizado. Deseja recuperar o que estava preenchendo?'))) {
    produto = { ...produto, ...recuperado.dados, id: produto.id };
    restaurado = true;
  }
  let pronto = false;
  const estado = { produto };
  const form = elemento('form', { className: 'form-admin' });
  form.classList.add('cadastro-produto-guiado');
  function etapa(numero, nome, explicacao, campos) {
    return elemento('fieldset', { className: 'etapa-cadastro-produto' }, [
      elemento('legend', {}, `${numero}. ${nome}`),
      elemento('p', { className: 'explicacao-etapa' }, explicacao), ...campos,
    ]);
  }
  const identificador = elemento('p', { className: 'id-produto-admin' },
    produto.id ? `ID do produto: #${produto.id}` : 'O ID será criado automaticamente ao salvar.');
  form.append(identificador);
  const gerais = elemento('div', { className: 'campos-duplos' }, [
    campo('Nome do produto', 'nome', produto.nome),
    campo('Categoria', 'categoria_id', produto.categoria_id || '', 'select', [
      { valor: '', nome: 'Selecione uma categoria' },
      ...categorias.map((item) => ({ valor: item.id, nome: `${item.nome}${item.ativa ? '' : ' (arquivada)'}` })),
    ]),
  ]);
  const descricao = campo('Descrição do produto', 'descricao', produto.descricao, 'textarea');
  const estoque = campo('Estoque (unidades)', 'estoque', produto.estoque ?? '', 'number', [],
    'Deixe vazio para não controlar. Informe 0 quando não houver unidades em estoque.');
  estoque.querySelector('input').max = '10000000';
  estoque.querySelector('input').placeholder = 'Sem controle';
  gerais.append(estoque);
  descricao.querySelector('textarea').maxLength = 3000;
  descricao.querySelector('textarea').placeholder = 'Explique o que é o produto, para que serve e seus diferenciais.';
  gerais.querySelector('[name="nome"]').placeholder = 'Ex.: Cartão de Visita';
  form.append(etapa(1, 'Apresente o produto', 'Comece pelo nome, escolha a categoria e escreva uma descrição para o cliente.', [gerais, descricao]));
  if (produto.preco > 0) {
    form.append(elemento('p', {}, `Valor do cadastro anterior preservado: ${new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL',
    }).format(produto.preco / 100)}. Confira a tiragem e cadastre o total na combinação correspondente.`));
  }

  const imagens = elemento('div', { className: 'imagens-editor' });
  function desenharImagens() {
    const galeria = estado.produto.galeria;
    imagens.replaceChildren();
    if (estado.produto.imagem_id) {
      const item = midias.find((entrada) => entrada.id === estado.produto.imagem_id);
      imagens.append(elemento('p', {}, 'Foto de capa — aparece no card do produto'),
        elemento('img', { src: item?.miniatura_url || '', alt: item?.alternativo || 'Imagem principal', className: 'mini-editor' }),
        botao('Remover foto de capa', () => { estado.produto.imagem_id = ''; desenharImagens(); }));
    }
    imagens.append(botao('Escolher foto de capa', async () => {
      const item = await selecionarMidia();
      if (item) {
        if (!midias.some((entrada) => entrada.id === item.id)) midias.push(item);
        estado.produto.imagem_id = item.id;
        desenharImagens();
      }
    }));
    const lista = elemento('ol', { className: 'galeria-editor' });
    galeria.forEach((idMidia, indice) => {
      const item = midias.find((entrada) => entrada.id === idMidia);
      lista.append(elemento('li', {}, [
        elemento('img', { src: item?.miniatura_url || '', alt: item?.alternativo || 'Imagem da galeria', className: 'mini-editor' }),
        botao('Subir', () => { mover(galeria, indice, -1); desenharImagens(); }),
        botao('Descer', () => { mover(galeria, indice, 1); desenharImagens(); }),
        botao('Remover da galeria', () => { galeria.splice(indice, 1); desenharImagens(); }),
      ]));
    });
    imagens.append(lista, botao('Adicionar outras fotos', async () => {
      const item = await selecionarMidia();
      if (item && !galeria.includes(item.id)) {
        if (!midias.some((entrada) => entrada.id === item.id)) midias.push(item);
        galeria.push(item.id);
        desenharImagens();
      }
    }));
    if (pronto) salvarLocal();
  }
  desenharImagens();
  form.append(etapa(2, 'Escolha as fotos', 'Selecione uma foto de capa na biblioteca. As outras fotos são opcionais e aparecem na página do produto.', [imagens]));

  const variacoes = editorVariacoes(estado);
  const caracteristicas = editorCaracteristicas(estado, () => variacoes.desenhar());
  form.append(etapa(3, 'Informe os detalhes e as escolhas',
    'Adicione informações como tamanho, material e acabamento. Escolha “Informação pronta” quando não houver escolha, ou “Opções para o cliente escolher” quando houver mais de uma possibilidade.', [caracteristicas.raiz]));
  const tiragens = controlar(campo('Quantidades disponíveis (em unidades)', 'tiragens', produto.tiragens.join(', '), 'text', [],
    'Separe as quantidades por vírgula. Exemplo: 500, 1000, 2000.'), (valor) => {
    estado.produto.tiragens = valor.split(',').map((item) => item.trim()).filter(Boolean).map(Number);
    variacoes.desenhar();
  });
  const comoMostrarPreco = controlar(campo('O cliente verá o preço no site?', 'comercial', produto.comercial, 'select', [
    { valor: 'orcamento', nome: 'Não — mostrar “Sob orçamento”' },
    { valor: 'preco', nome: 'Sim — cadastrar os preços abaixo' },
  ]), (valor) => { estado.produto.comercial = valor; variacoes.desenhar(); });
  form.append(etapa(4, 'Defina as quantidades e os preços',
    'Primeiro informe as quantidades. Depois adicione uma opção de venda para cada combinação que deseja oferecer. Exemplo: Couché 250g + Verniz + 500 unidades.', [comoMostrarPreco, tiragens, variacoes.raiz]));
  form.append(elemento('details', { className: 'ajustes-opcionais-produto' }, [
    elemento('summary', {}, 'Ajustes opcionais'),
    campo('Nome no link do produto', 'slug', produto.slug, 'text', [],
      'Você pode deixar vazio. O sistema cria o link usando o nome do produto. Exemplo: cartao-de-visita.'),
    campo('Destacar este produto no catálogo', 'destaque', produto.destaque, 'checkbox'),
  ]));

  const situacao = elemento('p', { className: 'estado-editor' }, `Situação: ${produto.estado}. Salvar preserva a versão já publicada até uma nova publicação.`);
  const salvar = elemento('button', { type: 'submit', className: 'botao' }, 'Publicar');
  const acoes = elemento('div', { className: 'acoes-linha acoes-cadastro-fixas' }, [salvar]);
  form.append(situacao, acoes);
  const modal = dialogo(id ? 'Editar produto' : 'Cadastrar produto', form, { fecharAoClicarFora: true });
  form.elements.nome.required = true;
  form.elements.nome.maxLength = 150;
  if (restaurado && typeof recuperado.quantidades === 'string') {
    form.elements.tiragens.value = recuperado.quantidades;
  }
  const avisoRascunho = elemento('p', { className: 'aviso-rascunho', role: 'status' },
    restaurado ? 'Cadastro recuperado. Você pode continuar de onde parou.'
      : 'O preenchimento é guardado automaticamente neste navegador. Para cadastrar no site, use Salvar rascunho ou Publicar.');
  form.prepend(avisoRascunho);

  function dadosFormulario() {
    return {
      ...estado.produto,
      ...Object.fromEntries(new FormData(form)),
      destaque: form.elements.destaque.checked,
      tiragens: estado.produto.tiragens,
    };
  }

  function assinatura(dados, quantidades) {
    return JSON.stringify({ dados, quantidades });
  }
  let baseAssinatura = assinatura(baseProduto, baseProduto.tiragens.join(', '));

  function salvarLocal() {
    if (!pronto) return;
    const dados = dadosFormulario();
    // O texto digitado é preservado mesmo se uma quantidade ainda estiver incompleta.
    const quantidades = form.elements.tiragens.value;
    if (assinatura(dados, quantidades) === baseAssinatura) {
      rascunho.limpar();
      return;
    }
    const salvo = rascunho.gravar(dados, quantidades, baseProduto.atualizado_em);
    avisoRascunho.textContent = salvo
      ? 'Preenchimento guardado neste navegador. Você pode fechar e continuar depois.'
      : 'Não foi possível guardar neste navegador. Salve o rascunho antes de sair.';
  }

  const limpar = botao('Limpar', () => {
    const editando = Boolean(estado.produto.id);
    if (!confirm(editando
      ? 'Descartar o preenchimento não salvo e voltar ao último cadastro salvo?'
      : 'Limpar todos os campos deste cadastro? O preenchimento guardado neste navegador também será apagado.')) return;
    estado.produto = structuredClone(baseProduto);
    for (const nome of ['nome', 'slug', 'descricao', 'categoria_id', 'comercial']) {
      form.elements[nome].value = baseProduto[nome] || '';
    }
    form.elements.estoque.value = baseProduto.estoque ?? '';
    form.elements.destaque.checked = Boolean(baseProduto.destaque);
    form.elements.tiragens.value = baseProduto.tiragens.join(', ');
    caracteristicas.desenhar();
    variacoes.desenhar();
    desenharImagens();
    modal.erro.textContent = '';
    rascunho.limpar();
    baseAssinatura = assinatura(dadosFormulario(), form.elements.tiragens.value);
    avisoRascunho.textContent = editando ? 'Alterações descartadas. O cadastro salvo foi mantido.' : 'Cadastro limpo. Você pode começar novamente.';
    form.elements.nome.focus();
  });
  acoes.append(limpar);
  pronto = true;
  if (!restaurado) baseAssinatura = assinatura(dadosFormulario(), form.elements.tiragens.value);
  form.addEventListener('input', salvarLocal);
  form.addEventListener('change', salvarLocal);
  form.addEventListener('click', () => queueMicrotask(salvarLocal));
  const aoSair = () => salvarLocal();
  window.addEventListener('pagehide', aoSair);
  window.addEventListener('beforeunload', aoSair);
  modal.dialog.addEventListener('close', () => {
    salvarLocal();
    pronto = false;
    window.removeEventListener('pagehide', aoSair);
    window.removeEventListener('beforeunload', aoSair);
  }, { once: true });

  async function salvarDados() {
    const enviado = dadosFormulario();
    const salvo = await requisitar(`/api/admin/produtos${estado.produto.id ? `/${estado.produto.id}` : ''}`, {
      method: estado.produto.id ? 'PUT' : 'POST', body: enviado,
    });
    estado.produto = salvo;
    identificador.textContent = `ID do produto: #${salvo.id}`;
    baseProduto = structuredClone(salvo);
    rascunho.limpar();
    rascunho = criarRascunhoProduto(armazenamento, usuarioAtual()?.id, salvo.id);
    rascunho.limpar();
    limpar.textContent = 'Limpar';
    form.elements.slug.value = salvo.slug;
    caracteristicas.desenhar();
    variacoes.desenhar();
    desenharImagens();
    baseAssinatura = assinatura(dadosFormulario(), form.elements.tiragens.value);
    rascunho.limpar();
    avisoRascunho.textContent = 'Cadastro salvo no sistema. Novas alterações serão guardadas neste navegador.';
    avisar('Rascunho salvo.');
    situacao.textContent = `Situação: ${salvo.estado}. Rascunho salvo.`;
    await aoSalvar();
    return salvo;
  }

  let executando = false;
  async function executar(acao) {
    if (executando || !form.reportValidity()) return;
    executando = true;
    modal.erro.textContent = '';
    const botoes = [...acoes.querySelectorAll('button')];
    botoes.forEach((item) => { item.disabled = true; });
    try {
      await acao();
    } catch (erro) {
      modal.erro.textContent = erro.message;
    } finally {
      executando = false;
      botoes.forEach((item) => { item.disabled = false; });
    }
  }

  enviar(form, () => executar(async () => {
    if (!confirm('Publicar esta versão no catálogo?')) return;
    const salvo = await salvarDados();
    estado.produto = await requisitar(`/api/admin/produtos/${salvo.id}/estado`, {
      method: 'POST', body: { acao: 'publicar' },
    });
    situacao.textContent = 'Produto publicado.';
    avisar('Produto publicado.');
    await aoSalvar();
    modal.dialog.close();
  }), modal.erro);

  const salvarRascunho = botao('Salvar rascunho', () => executar(async () => {
    await salvarDados();
    modal.dialog.close();
  }));
  acoes.replaceChildren(salvar, salvarRascunho, limpar);
  acoes.prepend(botao('Prévia editável', () => abrirPreviaEditavel({
    ler: dadosFormulario,
    midias,
    categorias,
    salvarRascunho: () => salvarRascunho.click(),
    publicar: () => salvar.click(),
    aplicar: (dados) => {
      estado.produto = dados;
      for (const nome of ['nome', 'descricao', 'categoria_id', 'comercial']) form.elements[nome].value = dados[nome] || '';
      form.elements.estoque.value = dados.estoque ?? '';
      form.elements.tiragens.value = dados.tiragens.join(', ');
      caracteristicas.desenhar();
      variacoes.desenhar();
      desenharImagens();
      salvarLocal();
    },
  })));
}
