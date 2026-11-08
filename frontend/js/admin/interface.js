export function elemento(tag, atributos = {}, filhos = []) {
  const node = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (chave === 'className') node.className = valor;
    else if (chave === 'textContent') node.textContent = valor;
    else if (chave.startsWith('on')) node.addEventListener(chave.slice(2).toLowerCase(), valor);
    else if (chave in node && !chave.startsWith('aria-')) node[chave] = valor;
    else node.setAttribute(chave, valor);
  }
  for (const filho of Array.isArray(filhos) ? filhos : [filhos]) {
    if (filho !== null && filho !== undefined) node.append(filho instanceof Node ? filho : String(filho));
  }
  return node;
}

export function avisar(texto, erro = false) {
  const aviso = document.querySelector('#aviso-admin');
  aviso.textContent = texto;
  aviso.setAttribute('role', erro ? 'alert' : 'status');
  aviso.classList.toggle('aviso-erro', erro);
  aviso.hidden = !texto;
}

export function botao(texto, acao, classe = 'botao-secundario') {
  const node = elemento('button', { type: 'button', className: classe }, texto);
  node.addEventListener('click', async () => {
    node.disabled = true;
    try { await acao(); } catch (erro) {
      const erroLocal = node.closest('dialog')?.querySelector('.erro-formulario');
      if (erroLocal) erroLocal.textContent = erro.message;
      else avisar(erro.message, true);
    }
    finally { node.disabled = false; }
  });
  return node;
}

export function campo(rotulo, nome, valor = '', tipo = 'text', opcoes = [], ajuda = '') {
  const id = `campo-${crypto.randomUUID()}`;
  let entrada;
  if (tipo === 'select') {
    entrada = elemento('select', { name: nome, id });
    for (const opcao of opcoes) {
      entrada.append(elemento('option', { value: String(opcao.valor), selected: String(opcao.valor) === String(valor) }, opcao.nome));
    }
  } else if (tipo === 'textarea') {
    entrada = elemento('textarea', { name: nome, id, value: valor ?? '', rows: 4 });
  } else {
    entrada = elemento('input', { type: tipo, name: nome, id });
    if (tipo === 'checkbox') entrada.checked = Boolean(valor);
    else entrada.value = valor ?? '';
    if (tipo === 'number') { entrada.min = '0'; entrada.step = '1'; }
  }
  const container = elemento('div', { className: tipo === 'checkbox' ? 'campo-admin campo-checkbox' : 'campo-admin' }, [
    elemento('label', { htmlFor: id }, rotulo), entrada,
  ]);
  if (ajuda) {
    const ajudaId = `${id}-ajuda`;
    entrada.setAttribute('aria-describedby', ajudaId);
    container.append(elemento('small', { id: ajudaId, className: 'ajuda-campo' }, ajuda));
  }
  return container;
}

export function controlar(campoNode, acao) {
  const input = campoNode.querySelector('input, select, textarea');
  input.addEventListener(input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input', () => {
    acao(input.type === 'checkbox' ? input.checked : input.value);
  });
  return campoNode;
}

export function titulo(texto, descricao = '') {
  return elemento('div', { className: 'titulo-admin' }, [
    elemento('h1', {}, texto), descricao ? elemento('p', {}, descricao) : null,
  ]);
}

export function tabela(colunas, linhas) {
  return elemento('div', { className: 'tabela-admin' }, elemento('table', {}, [
    elemento('thead', {}, elemento('tr', {}, colunas.map((texto) => elemento('th', { scope: 'col' }, texto)))),
    elemento('tbody', {}, linhas),
  ]));
}

export function dialogo(tituloTexto, conteudo, opcoes = {}) {
  const origem = document.activeElement;
  const abrirMenu = origem?.closest('.acoes-produto-compactas')?.querySelector('.abrir-acoes-produto');
  const erro = elemento('p', { className: 'erro-formulario', role: 'alert' });
  const dialog = elemento('dialog', { className: 'dialog-admin' });
  const nomeId = `titulo-${crypto.randomUUID()}`;
  dialog.setAttribute('aria-labelledby', nomeId);
  dialog.append(elemento('div', { className: 'topo-dialog' }, [
    elemento('h2', { id: nomeId }, tituloTexto), botao('Fechar', () => dialog.close()),
  ]), erro, conteudo);
  document.body.append(dialog);
  if (opcoes.fecharAoClicarFora) {
    function fora(evento) {
      const limites = dialog.getBoundingClientRect();
      return evento.target === dialog && (evento.clientX < limites.left || evento.clientX > limites.right
        || evento.clientY < limites.top || evento.clientY > limites.bottom);
    }
    let iniciouFora = false;
    dialog.addEventListener('pointerdown', (evento) => { iniciouFora = fora(evento); });
    dialog.addEventListener('click', (evento) => {
      if (iniciouFora && fora(evento)) dialog.close();
      iniciouFora = false;
    });
  }
  dialog.addEventListener('close', () => {
    dialog.remove();
    const foco = abrirMenu?.isConnected ? abrirMenu : origem;
    if (foco?.isConnected && !foco.disabled && !foco.closest('[inert]')) foco.focus({ preventScroll: true });
  }, { once: true });
  dialog.showModal();
  return { dialog, erro };
}

export function enviar(form, acao, erroLocal) {
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (form.getAttribute('aria-busy') === 'true' || !form.reportValidity()) return;
    form.setAttribute('aria-busy', 'true');
    const botoes = [...form.querySelectorAll('button[type="submit"]')];
    botoes.forEach((item) => { item.disabled = true; });
    try {
      if (erroLocal) erroLocal.textContent = '';
      await acao(new FormData(form));
    } catch (erro) {
      if (erroLocal) {
        erroLocal.textContent = erro.message;
        erroLocal.tabIndex = -1;
        erroLocal.focus();
      }
      else avisar(erro.message, true);
    } finally {
      botoes.forEach((item) => { item.disabled = false; });
      form.removeAttribute('aria-busy');
    }
  });
}

export function mover(lista, indice, direcao) {
  const destino = indice + direcao;
  if (destino < 0 || destino >= lista.length) return;
  [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
}

export function formatarData(valor) {
  const data = new Date(valor.includes('T') ? valor : `${valor.replace(' ', 'T')}Z`);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
  }).format(data);
}
