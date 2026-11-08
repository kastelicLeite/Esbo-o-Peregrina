const normalizar = texto => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function recomendarProdutos(catalogo, eventos = [], limite = 12, agora = Date.now()) {
  const produtos = [...new Map(catalogo.filter(item => item.variacoes?.length).map(item => [item.id, item])).values()];
  const categorias = new Map();
  const sinais = new Map();
  const vistos = new Set();
  const marcar = (produto, peso, motivo) => {
    if (!produto) return;
    const anterior = sinais.get(produto.id) || { peso: 0 };
    sinais.set(produto.id, { peso: anterior.peso + peso, motivo: peso > (anterior.maior || 0) ? motivo : anterior.motivo,
      maior: Math.max(peso, anterior.maior || 0) });
    const categoria = categorias.get(produto.categoria_id) || { peso: 0, motivo };
    categorias.set(produto.categoria_id, { peso: categoria.peso + peso / 2, motivo });
  };
  for (const evento of eventos) {
    const idade = Math.max(0, agora - evento.criado_em) / 86400000;
    if (!Number.isFinite(idade) || idade > 90) continue;
    const recente = Math.exp(-idade / 21);
    if (evento.tipo === 'visualizacao') {
      const produto = produtos.find(item => item.id === evento.dados.produto_id);
      vistos.add(evento.dados.produto_id);
      marcar(produto, 3 * recente, 'Com base nos produtos que você viu');
    } else if (evento.tipo === 'orcamento') {
      for (const item of evento.dados.itens || []) marcar(produtos.find(produto => produto.id === item.produto_id),
        8 * recente, 'Relacionado aos seus orçamentos preparados');
    } else if (evento.tipo === 'pesquisa') {
      const termos = normalizar(evento.dados.termo).split(/\s+/).filter(termo => termo.length >= 2);
      if (!termos.length) continue;
      for (const produto of produtos) {
        const texto = normalizar(`${produto.nome} ${produto.categoria} ${produto.descricao}`);
        if (termos.every(termo => texto.includes(termo))) marcar(produto, 5 * recente, 'Relacionado às suas pesquisas');
      }
    }
  }
  const candidatos = produtos.map(produto => {
    const sinal = sinais.get(produto.id);
    const categoria = categorias.get(produto.categoria_id);
    return { produto, pontos: Math.min(20, sinal?.peso || 0) + Math.min(12, categoria?.peso || 0) + (produto.destaque ? 1 : 0)
      - (vistos.has(produto.id) ? 1 : 0), motivo: sinal?.motivo || categoria?.motivo
      || (produto.destaque ? 'Destaque do catálogo' : 'Explore este produto') };
  });
  const resultado = [];
  const contagem = new Map();
  while (candidatos.length && resultado.length < limite) {
    candidatos.sort((a, b) => (b.pontos - (contagem.get(b.produto.categoria_id) || 0) * 3)
      - (a.pontos - (contagem.get(a.produto.categoria_id) || 0) * 3)
      || (a.produto.posicao || 0) - (b.produto.posicao || 0) || a.produto.id - b.produto.id);
    const escolhido = candidatos.shift();
    resultado.push(escolhido);
    contagem.set(escolhido.produto.categoria_id, (contagem.get(escolhido.produto.categoria_id) || 0) + 1);
  }
  return resultado;
}
