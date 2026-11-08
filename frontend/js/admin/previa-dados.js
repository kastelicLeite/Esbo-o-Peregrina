export function centavosPrevia(valor) {
  const texto = String(valor ?? '').trim().replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(texto) ? Math.round(Number(texto) * 100) : null;
}

export function produtoParaPrevia(dados, midias, categorias) {
  const imagem = (id) => {
    const item = midias.find((midia) => midia.id === id);
    return item ? { ...item, miniatura: item.miniatura_url } : null;
  };
  const caracteristicas = dados.caracteristicas.filter((item) => item.ativo)
    .map((item) => ({ ...item, valores: item.valores.filter((valor) => valor.ativo)
      .map((valor) => ({ ...valor, imagem: imagem(valor.imagem_id) })) }));
  const selecoes = caracteristicas.filter((item) => item.tipo === 'selecao');
  const variacoes = dados.variacoes.filter((item) => item.ativa && item.disponivel
    && dados.tiragens.includes(item.quantidade) && Object.keys(item.opcoes).length === selecoes.length
    && selecoes.every((campo) => campo.valores.some((valor) => valor.id === item.opcoes[campo.id])))
    .map((item) => ({ ...item,
      total_centavos: dados.comercial === 'preco' ? centavosPrevia(item.total) : null,
      unitario_centavos: dados.comercial === 'preco' ? centavosPrevia(item.unitario) : null,
    }));
  return { ...dados, id: dados.id || 'previa', nome: dados.nome || 'Nome do produto',
    categoria: categorias.find((item) => Number(item.id) === Number(dados.categoria_id))?.nome || 'Categoria',
    imagem: imagem(dados.imagem_id), galeria: dados.galeria.map(imagem).filter(Boolean), caracteristicas, variacoes };
}

export function selecionarNaPrevia(produto, simulacao) {
  return produto.variacoes.find((item) => item.quantidade === simulacao.quantidade
    && Object.entries(simulacao.opcoes).every(([chave, valor]) => item.opcoes[chave] === valor))
    || produto.variacoes.find((item) => Object.entries(simulacao.opcoes)
      .every(([chave, valor]) => item.opcoes[chave] === valor)) || produto.variacoes[0];
}
