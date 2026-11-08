const menu = document.querySelector('.categorias-cabecalho');

if (menu) {
  const lista = menu.querySelector('.lista-categorias-cabecalho');
  const botao = menu.querySelector('summary');
  let carregado = false;
  let carregando = false;

  menu.addEventListener('toggle', async () => {
    if (!menu.open || carregado || carregando) return;
    carregando = true;
    try {
      const respostas = await Promise.all([
        fetch('/api/categorias', { cache: 'no-store' }),
        fetch('/api/produtos', { cache: 'no-store' }),
      ]);
      if (respostas.some((resposta) => !resposta.ok)) throw new Error();
      const [categorias, produtos] = await Promise.all(respostas.map((resposta) => resposta.json()));
      const usadas = new Set(produtos.map((produto) => String(produto.categoria_id)));
      const links = categorias.filter((categoria) => usadas.has(String(categoria.id)))
        .map((categoria) => {
          const link = document.createElement('a');
          link.href = `/paginas/produtos.html?${new URLSearchParams({ categoria: categoria.id })}`;
          link.textContent = categoria.nome;
          return link;
        });
      lista.replaceChildren(...links);
      if (!links.length) lista.textContent = 'Nenhuma categoria com produtos disponíveis.';
      carregado = true;
    } catch {
      lista.textContent = 'Não foi possível carregar. Feche e abra para tentar novamente.';
    } finally {
      carregando = false;
    }
  });

  menu.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || !menu.open) return;
    evento.preventDefault();
    evento.stopPropagation();
    menu.open = false;
    botao.focus();
  });
  document.addEventListener('pointerdown', (evento) => {
    if (!menu.contains(evento.target)) menu.open = false;
  });
  menu.addEventListener('focusout', (evento) => {
    if (!menu.contains(evento.relatedTarget)) menu.open = false;
  });
}
