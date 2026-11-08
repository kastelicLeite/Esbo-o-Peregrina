function criar(tag, texto, classe) {
  const elemento = document.createElement(tag);
  if (texto) elemento.textContent = texto;
  if (classe) elemento.className = classe;
  return elemento;
}

export async function prepararEdicaoRapida() {
  let sessao;
  try {
    const resposta = await fetch('/api/conta/sessao', { cache: 'no-store' });
    if (!resposta.ok) return () => {};
    sessao = await resposta.json();
  } catch { return () => {}; }
  if (!['administrador', 'criador'].includes(sessao.usuario?.perfil)) return () => {};

  return (cartao, produto) => {
    const raiz = criar('details', '', 'edicao-rapida-catalogo');
    raiz.append(criar('summary', 'Editar nome e estoque'));
    const conteudo = criar('div');
    raiz.append(conteudo);
    cartao.querySelector('.corpo-cartao').append(raiz);
    let carregando = false;

    async function consultar(metodo = 'GET', body) {
      const resposta = await fetch(`/api/admin/produtos/${produto.id}/edicao-rapida`, {
        method: metodo, cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': sessao.csrf },
        body: body ? JSON.stringify(body) : undefined,
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        const erro = new Error(dados.erro || 'Não foi possível salvar.');
        erro.codigo = dados.codigo;
        throw erro;
      }
      return dados;
    }

    raiz.addEventListener('toggle', async () => {
      if (!raiz.open || carregando) return;
      carregando = true;
      conteudo.textContent = 'Carregando edição…';
      try {
        let atual = await consultar();
        const form = criar('form');
        const nome = criar('input');
        nome.type = 'text';
        nome.required = true;
        nome.maxLength = 150;
        nome.value = atual.nome;
        const estoque = criar('input');
        estoque.type = 'number';
        estoque.min = 0;
        estoque.max = 10000000;
        estoque.step = 1;
        estoque.placeholder = 'Sem controle';
        estoque.value = atual.estoque ?? '';
        for (const [rotulo, entrada] of [['Nome do produto', nome], ['Estoque (unidades)', estoque]]) {
          const label = criar('label', rotulo);
          label.append(entrada);
          form.append(label);
        }
        const ajuda = criar('p', 'O nome muda no site ao salvar. O estoque é interno: vazio = sem controle; zero = sem estoque. Outras alterações pendentes não serão publicadas.');
        const salvar = criar('button', 'Salvar nome e estoque', 'botao-secundario');
        salvar.type = 'submit';
        const estado = criar('p');
        estado.setAttribute('role', 'status');
        form.append(ajuda, salvar, estado);
        form.addEventListener('submit', async (evento) => {
          evento.preventDefault();
          if (salvar.disabled || !form.reportValidity()) return;
          salvar.disabled = true;
          nome.disabled = estoque.disabled = true;
          estado.textContent = 'Salvando…';
          try {
            atual = await consultar('PUT', { nome: nome.value, estoque: estoque.value === '' ? null : Number(estoque.value),
              nome_anterior: atual.nome, estoque_anterior: atual.estoque });
            produto.nome = atual.nome;
            nome.value = atual.nome;
            cartao.querySelector('h3 a').textContent = atual.nome;
            cartao.querySelector('.ver-opcoes').setAttribute('aria-label', `Ver ${atual.nome}`);
            estado.textContent = 'Nome e estoque salvos.';
          } catch (erro) { estado.textContent = erro.message; }
          finally { salvar.disabled = false; nome.disabled = estoque.disabled = false; }
        });
        conteudo.replaceChildren(form);
      } catch (erro) {
        conteudo.replaceChildren(criar('p', erro.message));
        if (erro.codigo === 'SENHA_PAINEL') {
          const link = criar('a', 'Desbloquear painel em outra aba');
          link.href = '/paginas/acesso-painel.html';
          link.target = '_blank';
          link.rel = 'noopener';
          conteudo.append(link, criar('p', 'Depois de desbloquear, feche e abra esta edição novamente.'));
        }
      } finally { carregando = false; }
    });
  };
}
