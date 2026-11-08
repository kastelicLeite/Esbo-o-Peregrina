import { requisitar } from './api.js';
import { elemento, campo, titulo, botao, dialogo, enviar, avisar } from './interface.js';
import { normalizarPesquisa } from '../pesquisa-produtos.js';
import { substituirMidia } from './substituir-midia.js';
import { usarIcone } from './acoes-produto.js';

export async function selecionarMidia() {
  const midias = await requisitar('/api/admin/midias');
  return new Promise((resolver) => {
    let selecionada = null;
    const busca = campo('Pesquisar imagem pelo nome', 'busca-imagem', '', 'search');
    const entrada = busca.querySelector('input');
    entrada.placeholder = 'Digite o nome da imagem…';
    entrada.maxLength = 150;
    const resultado = elemento('p', { role: 'status', className: 'resultado-busca-imagens' });
    const grade = elemento('div', { className: 'grade-midias' });
    const adicionar = botao('Adicionar novas imagens', () => {
      const area = elemento('div');
      const janela = dialogo('Adicionar imagens à biblioteca', area);
      montarEnvioImagens(area, async (imagem) => {
        midias.unshift(imagem);
        entrada.value = '';
        desenhar();
      }, () => {
        janela.dialog.close();
        entrada.focus();
        resultado.textContent = 'Imagens adicionadas. Clique em uma delas para usar no produto.';
      });
    }, 'botao');
    const cabecalho = elemento('div', { className: 'cabecalho-selecao-imagens' }, [busca, adicionar]);
    const modal = dialogo('Selecionar imagem da biblioteca', elemento('div', {}, [cabecalho, resultado, grade]));
    function desenhar() {
      const termos = normalizarPesquisa(entrada.value).split(' ').filter(Boolean);
      const filtradas = midias.filter((item) => termos.every((termo) => normalizarPesquisa(item.nome).includes(termo)));
      grade.replaceChildren();
      resultado.textContent = !midias.length
        ? 'A biblioteca está vazia. Clique em “Adicionar novas imagens” para começar.'
        : !filtradas.length ? 'Nenhuma imagem encontrada. Tente outro nome.'
          : `${filtradas.length} ${filtradas.length === 1 ? 'imagem encontrada' : 'imagens encontradas'}.`;
      filtradas.forEach((item) => {
        grade.append(elemento('button', {
          type: 'button', className: 'midia-escolha',
          onclick: () => { selecionada = item; modal.dialog.close(); },
        }, [elemento('img', { src: item.miniatura_url, alt: item.alternativo || item.nome, loading: 'lazy' }), elemento('span', {}, item.nome)]));
      });
    }
    entrada.addEventListener('input', desenhar);
    desenhar();
    entrada.focus();
    modal.dialog.addEventListener('close', () => resolver(selecionada), { once: true });
  });
}

export async function montar(container) {
  let midias = await requisitar('/api/admin/midias');
  container.replaceChildren(titulo('Biblioteca de imagens', 'Arquivos próprios ou autorizados. JPG, PNG, WebP e AVIF; até 8 MB.'));
  montarEnvioImagens(container, async (imagem) => {
    midias.unshift(imagem);
    desenhar();
  });

  const filtro = campo('Buscar imagens pelo nome', 'busca');
  const grade = elemento('div', { className: 'grade-midias' });
  container.append(filtro, grade);
  function desenhar() {
    const busca = filtro.querySelector('input').value.toLocaleLowerCase('pt-BR');
    grade.replaceChildren();
    const filtradas = midias.filter((item) => item.nome.toLocaleLowerCase('pt-BR').includes(busca));
    if (!filtradas.length) grade.append(elemento('p', {}, 'Nenhuma imagem encontrada.'));
    for (const item of filtradas) {
      const cartao = elemento('article', { className: 'midia-admin' }, [
        elemento('img', { src: item.miniatura_url, alt: item.alternativo || item.nome, loading: 'lazy' }),
        elemento('h3', {}, item.nome),
      ]);
      let modalEdicao;
      const abrirEdicao = botao('Editar nome', () => {
        editar.elements.nome.value = item.nome;
        editar.elements.alternativo.value = item.alternativo || '';
        erroNome.textContent = '';
        modalEdicao = dialogo('Editar nome da imagem', elemento('div', {}, [editar, erroNome]));
        editar.elements.nome.focus();
      });
      const editar = elemento('form', { className: 'form-admin nome-midia-form' }, [
        campo('Nome da imagem', 'nome', item.nome),
        campo('Descrição da imagem para acessibilidade', 'alternativo', item.alternativo || '', 'textarea', [],
          'Descreva o que a foto mostra. Exemplo: sacola kraft com alça de cordão e logo azul. Essa descrição é lida por leitores de tela.'),
        elemento('button', { type: 'submit', className: 'botao-secundario' }, 'Salvar nome e descrição'),
      ]);
      const erroNome = elemento('p', { role: 'alert', className: 'erro-formulario' });
      editar.elements.nome.required = true;
      editar.elements.nome.maxLength = 150;
      editar.elements.alternativo.maxLength = 300;
      editar.elements.alternativo.required = true;
      enviar(editar, async (dados) => {
        const nome = String(dados.get('nome')).trim();
        const alternativo = String(dados.get('alternativo')).trim();
        const atualizada = await requisitar(`/api/admin/midias/${item.id}`, { method: 'PUT', body: { nome, alternativo } });
        if (atualizada.nome !== nome) {
          throw new Error('O servidor está usando uma versão antiga. Feche a janela do servidor, abra iniciar-site.cmd e tente novamente.');
        }
        item.nome = atualizada.nome;
        item.alternativo = atualizada.alternativo;
        cartao.querySelector('h3').textContent = atualizada.nome;
        cartao.querySelector('img').alt = atualizada.alternativo;
        usarIcone(abrirEdicao, 'editar', `Editar nome de ${item.nome}`);
        usarIcone(excluir, 'excluir', `Excluir imagem ${item.nome}`);
        editar.elements.nome.value = atualizada.nome;
        modalEdicao.dialog.close();
        avisar('Nome e descrição da imagem atualizados.');
      }, erroNome);
      const excluir = botao('Excluir imagem', async () => {
        if (!confirm(`Excluir a imagem “${item.nome}”?`)) return;
        await requisitar(`/api/admin/midias/${item.id}`, { method: 'DELETE' });
        midias = midias.filter((midia) => midia.id !== item.id);
        desenhar();
      });
      const substituir = botao('Substituir imagem', () => substituirMidia(item, (atualizada) => {
        midias = midias.map(midia => midia.id === atualizada.id ? atualizada : midia);
        desenhar();
      }));
      cartao.append(elemento('div', { className: 'acoes-midia' }, [
        usarIcone(abrirEdicao, 'editar', `Editar nome de ${item.nome}`),
        substituir,
        usarIcone(excluir, 'excluir', `Excluir imagem ${item.nome}`),
      ]));
      grade.append(cartao);
    }
  }
  filtro.querySelector('input').addEventListener('input', desenhar);
  desenhar();
}

function montarEnvioImagens(container, aoEnviar, aoConcluir) {
  const form = elemento('form', { className: 'form-admin bloco-admin' }, [
    campo('Como adicionar a imagem?', 'origem', 'colar', 'select', [
      { valor: 'arquivo', nome: 'Escolher arquivo do computador' },
      { valor: 'colar', nome: 'Colar imagens copiadas' },
      { valor: 'link', nome: 'Importar pelo link da imagem' },
    ]),
    campo('Escolher imagens do computador', 'imagem', '', 'file'),
    campo('Nome da imagem', 'nome'),
    elemento('button', { type: 'submit', className: 'botao' }, 'Enviar imagens'),
  ]);
  form.elements.imagem.multiple = true;
  form.elements.imagem.accept = 'image/jpeg,image/png,image/webp,image/avif';
  form.elements.nome.required = true;
  form.elements.nome.maxLength = 150;
  const areaArquivo = form.elements.imagem.closest('.campo-admin');
  const areaLink = campo('Link direto da imagem', 'url', '', 'url', [],
    'Cole o endereço https:// do arquivo da imagem, não o endereço de uma página. Até 8 MB.');
  const areaColar = elemento('div', { className: 'area-colar-imagem', tabIndex: 0 }, [
    elemento('p', {}, 'Cole imagens com Ctrl + V (ou ⌘ + V no Mac). Você pode colar várias de uma vez ou repetir para adicionar mais.'),
  ]);
  const estadoColar = elemento('p', { role: 'status' }, 'Nenhuma imagem colada.');
  const filaVisual = elemento('div', { className: 'fila-imagens-coladas' });
  areaColar.append(estadoColar, filaVisual);
  form.insertBefore(areaLink, areaArquivo);
  form.insertBefore(areaColar, areaArquivo);
  const imagensColadas = [];
  const imagensArquivos = [];
  const filaArquivosVisual = elemento('div', { className: 'fila-imagens-coladas' });
  areaArquivo.append(filaArquivosVisual);
  let enviando = false;
  function desenharFila() {
    const fila = form.elements.origem.value === 'arquivo' ? imagensArquivos : imagensColadas;
    const visual = form.elements.origem.value === 'arquivo' ? filaArquivosVisual : filaVisual;
    visual.replaceChildren();
    estadoColar.textContent = fila.length
      ? `${fila.length} ${fila.length === 1 ? 'imagem pronta' : 'imagens prontas'} para enviar. Limite de 20 imagens, até 8 MB cada.`
      : 'Nenhuma imagem colada.';
    const nome = form.elements.nome.value.trim();
    fila.forEach((item, indice) => {
      const legenda = item.nome || (nome
        ? `${nome.slice(0, 140)}${fila.length > 1 ? ` ${indice + 1}` : ''}`
        : `Imagem ${indice + 1}`);
      const remover = botao('Remover', () => {
        if (enviando) return;
        URL.revokeObjectURL(item.previa);
        fila.splice(indice, 1);
        desenharFila();
      });
      remover.disabled = enviando;
      visual.append(elemento('div', { className: 'imagem-colada-item' }, [
        elemento('img', { src: item.previa, alt: '', width: 80, height: 80 }),
        elemento('span', {}, legenda), remover,
      ]));
    });
  }
  form.elements.nome.addEventListener('input', desenharFila);
  function mudarOrigem() {
    const origem = form.elements.origem.value;
    areaArquivo.hidden = origem !== 'arquivo';
    areaLink.hidden = origem !== 'link';
    areaColar.hidden = origem !== 'colar';
    form.elements.imagem.required = origem === 'arquivo';
    form.elements.imagem.disabled = origem !== 'arquivo';
    form.elements.url.required = origem === 'link';
    form.elements.url.disabled = origem !== 'link';
  }
  form.elements.origem.addEventListener('change', () => { mudarOrigem(); desenharFila(); });
  form.elements.imagem.addEventListener('change', () => {
    const arquivos = [...form.elements.imagem.files];
    imagensArquivos.forEach((item) => URL.revokeObjectURL(item.previa));
    imagensArquivos.length = 0;
    if (arquivos.length > 20 || arquivos.some((arquivo) => arquivo.size > 8 * 1024 * 1024)) {
      erro.textContent = 'Selecione até 20 imagens, com até 8 MB cada.';
      form.elements.imagem.value = '';
    } else {
      erro.textContent = '';
      imagensArquivos.push(...arquivos.map((arquivo) => ({ arquivo, previa: URL.createObjectURL(arquivo) })));
    }
    desenharFila();
  });
  form.addEventListener('paste', (evento) => {
    const imagens = [...(evento.clipboardData?.items || [])]
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile()).filter(Boolean);
    if (!imagens.length) return;
    evento.preventDefault();
    if (enviando) return;
    if (imagens.some((imagem) => imagem.size > 8 * 1024 * 1024)) {
      erro.textContent = 'Cada imagem deve ter até 8 MB.';
      return;
    }
    if (imagensColadas.length + imagens.length > 20) {
      erro.textContent = 'Envie até 20 imagens por vez.';
      return;
    }
    imagensColadas.push(...imagens.map((arquivo) => ({ arquivo, previa: URL.createObjectURL(arquivo) })));
    form.elements.origem.value = 'colar';
    mudarOrigem();
    erro.textContent = '';
    desenharFila();
  });
  mudarOrigem();
  const erro = elemento('p', { role: 'alert', className: 'erro-formulario' });
  container.append(form, erro);
  enviar(form, async (dados) => {
    const origem = form.elements.origem.value;
    if (origem === 'link') {
      const salva = await requisitar('/api/admin/midias/importar-link', { method: 'POST', body: {
        url: form.elements.url.value.trim(),
        nome: form.elements.nome.value,
      } });
      await aoEnviar(salva);
    } else {
      dados.delete('origem');
      dados.delete('url');
      {
        const fila = origem === 'arquivo' ? imagensArquivos : imagensColadas;
        if (!fila.length) throw new Error('Adicione as imagens antes de enviar.');
        const nome = form.elements.nome.value.trim().slice(0, 140);
        fila.forEach((item, indice) => {
          item.nome ||= `${nome}${fila.length > 1 ? ` ${indice + 1}` : ''}`;
        });
        enviando = true;
        form.elements.imagem.disabled = true;
        form.elements.nome.disabled = true;
        form.elements.origem.disabled = true;
        desenharFila();
        try {
          while (fila.length) {
            const item = fila[0];
            const envio = new FormData();
            envio.set('nome', item.nome);
            envio.set('imagem', item.arquivo, item.arquivo.name || 'imagem-colada.png');
            const salva = await requisitar('/api/admin/midias', { method: 'POST', body: envio });
            await aoEnviar(salva);
            fila.shift();
            URL.revokeObjectURL(item.previa);
            desenharFila();
          }
        } finally {
          enviando = false;
          mudarOrigem();
          form.elements.nome.disabled = false;
          form.elements.origem.disabled = false;
          desenharFila();
        }
      }
    }
    form.reset();
    form.elements.origem.value = origem;
    imagensColadas.forEach((item) => URL.revokeObjectURL(item.previa));
    imagensColadas.length = 0;
    imagensArquivos.forEach((item) => URL.revokeObjectURL(item.previa));
    imagensArquivos.length = 0;
    filaArquivosVisual.replaceChildren();
    desenharFila();
    mudarOrigem();
    avisar('Imagens enviadas e salvas na biblioteca.');
    aoConcluir?.();
  }, erro);

}
