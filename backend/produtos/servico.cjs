const { banco, transacao, registrar } = require('../dados/banco.cjs');
const { exigir, gerarSlug } = require('../http/validacao.cjs');
const { validarProduto, validarVariacoes, combinacaoValida } = require('./validacao.cjs');

function imagem(id) {
  const registro = id && banco.prepare('SELECT * FROM midias WHERE id = ?').get(id);
  return registro ? {
    id: registro.id,
    url: `/midias/${registro.arquivo}`,
    miniatura: `/midias/${registro.miniatura}`,
    alternativo: registro.alternativo,
    largura: registro.largura,
    altura: registro.altura,
  } : null;
}

function obterProduto(id) {
  const produto = banco.prepare('SELECT * FROM produtos WHERE id = ?').get(id);
  exigir(produto, 'Produto não encontrado.', 404);
  const variacoes = banco.prepare('SELECT * FROM variacoes WHERE produto_id = ? ORDER BY id').all(id)
    .map((item) => ({
      ...item,
      opcoes: JSON.parse(item.opcoes),
      total: item.total_centavos === null ? '' : (item.total_centavos / 100).toFixed(2),
      unitario: item.unitario_centavos == null ? '' : (item.unitario_centavos / 100).toFixed(2),
      ativa: Boolean(item.ativa),
      disponivel: Boolean(item.disponivel),
      aproximado: Boolean(item.aproximado),
    }));

  return {
    ...produto,
    destaque: Boolean(produto.destaque),
    galeria: JSON.parse(produto.galeria),
    caracteristicas: JSON.parse(produto.caracteristicas),
    tiragens: JSON.parse(produto.tiragens),
    variacoes,
    pendente: produto.estado === 'publicado'
      && produto.atualizado_em !== JSON.parse(produto.publicado_json || '{}').atualizado_em,
    publicado_json: undefined,
  };
}

function pendencias(produto) {
  const avisos = [];
  if (!produto.descricao.trim()) avisos.push('Descrição');
  const categoria = produto.categoria_id && banco.prepare('SELECT * FROM categorias WHERE id = ?').get(produto.categoria_id);
  if (!categoria?.ativa) avisos.push('Categoria ativa');
  if (!imagem(produto.imagem_id)) avisos.push('Imagem principal');
  if (imagem(produto.imagem_id) && !imagem(produto.imagem_id).alternativo) avisos.push('Texto alternativo da imagem principal');
  const validas = produto.variacoes.filter((item) => combinacaoValida(item, produto));
  if (!validas.length) avisos.push('Uma combinação disponível com tiragem e opções válidas');
  for (const item of produto.caracteristicas.filter((campo) => campo.ativo)) {
    if (item.tipo === 'fixa' && !item.valor) avisos.push(`Valor fixo: ${item.nome}`);
  }
  return avisos;
}

function apresentarProduto(produto) {
  const variacoes = produto.variacoes.filter((item) => combinacaoValida(item, produto));
  const precificadas = variacoes.filter((item) => item.total_centavos > 0)
    .sort((a, b) => a.total_centavos - b.total_centavos || a.quantidade - b.quantidade);
  const menor = produto.comercial === 'preco' ? precificadas[0] : null;

  return {
    id: produto.id,
    nome: produto.nome,
    slug: produto.slug,
    descricao: produto.descricao,
    categoria_id: produto.categoria_id,
    categoria: banco.prepare('SELECT nome FROM categorias WHERE id = ?').get(produto.categoria_id)?.nome || '',
    destaque: produto.destaque,
    posicao: produto.posicao,
    comercial: produto.comercial,
    imagem: imagem(produto.imagem_id),
    galeria: produto.galeria.map(imagem).filter(Boolean),
    caracteristicas: produto.caracteristicas.filter((item) => item.ativo)
      .map((item) => ({ ...item, valores: item.valores.filter((valor) => valor.ativo)
        .map((valor) => ({ ...valor, imagem: imagem(valor.imagem_id) })) })),
    tiragens: [...new Set(produto.tiragens)],
    variacoes: variacoes.map((item) => ({
      id: item.id,
      opcoes: item.opcoes,
      quantidade: item.quantidade,
      total_centavos: produto.comercial === 'preco' ? item.total_centavos : null,
      unitario_centavos: produto.comercial === 'preco' ? item.unitario_centavos : null,
      aproximado: Boolean(item.aproximado),
    })),
    menor_preco: menor ? { total_centavos: menor.total_centavos, quantidade: menor.quantidade,
      unitario_centavos: menor.unitario_centavos, aproximado: Boolean(menor.aproximado) } : null,
    numero_opcoes: produto.caracteristicas.filter((item) => item.ativo && item.tipo === 'selecao')
      .reduce((total, item) => total + item.valores.filter((valor) => valor.ativo).length, 0),
    numero_variacoes: variacoes.length,
    atualizado_em: produto.atualizado_em,
  };
}

function listarPublicos() {
  return banco.prepare("SELECT publicado_json FROM produtos WHERE estado = 'publicado' AND publicado_json IS NOT NULL")
    .all().map((item) => JSON.parse(item.publicado_json))
    .filter((item) => banco.prepare('SELECT 1 FROM categorias WHERE id = ? AND ativa = 1').get(item.categoria_id))
    .map((item) => ({
      ...item,
      categoria: banco.prepare('SELECT nome FROM categorias WHERE id = ?').get(item.categoria_id).nome,
      imagem: imagem(item.imagem?.id),
      galeria: item.galeria.map((registro) => imagem(registro.id)).filter(Boolean),
      caracteristicas: item.caracteristicas.map((campo) => ({ ...campo,
        valores: campo.valores.map((valor) => ({ ...valor, imagem: imagem(valor.imagem_id) })) })),
    }))
    .sort((a, b) => Number(b.destaque) - Number(a.destaque) || a.posicao - b.posicao || a.nome.localeCompare(b.nome));
}

function salvarProduto(id, dados, usuario) {
  const produto = validarProduto(dados);
  const variacoes = validarVariacoes(dados.variacoes || [], produto);
  return transacao(() => {
    const anterior = id ? obterProduto(id) : null;
    if (anterior && !Object.hasOwn(dados, 'estoque')) produto.estoque = anterior.estoque;
    if (anterior && dados.atualizado_em) exigir(anterior.atualizado_em === dados.atualizado_em,
      'Este produto mudou em outra sessão. Reabra-o antes de salvar.', 409);
    if (produto.categoria_id) exigir(banco.prepare('SELECT id FROM categorias WHERE id = ?').get(produto.categoria_id),
      'Categoria não encontrada.');
    for (const midia of [produto.imagem_id, ...produto.galeria,
      ...produto.caracteristicas.flatMap((campo) => campo.valores.map((valor) => valor.imagem_id))].filter(Boolean)) {
      exigir(imagem(midia), 'Uma imagem selecionada não está mais disponível.');
    }
    if (!produto.slug) {
      const base = gerarSlug(produto.nome);
      produto.slug = base;
      let sufixo = 2;
      while (banco.prepare(`SELECT id FROM produtos WHERE id != ? AND
        (slug = ? OR json_extract(publicado_json, '$.slug') = ?)`).get(id || 0, produto.slug, produto.slug)) {
        produto.slug = `${base}-${sufixo++}`;
      }
    }
    exigir(!banco.prepare(`SELECT id FROM produtos WHERE id != ? AND
      (slug = ? OR json_extract(publicado_json, '$.slug') = ?)`).get(id || 0, produto.slug, produto.slug),
      'Este endereço já pertence a outro produto.');

    if (anterior) {
      for (const variacao of anterior.variacoes) {
        for (const [chave, valor] of Object.entries(variacao.opcoes)) {
          exigir(produto.caracteristicas.some((campo) => campo.id === chave
            && campo.valores.some((opcao) => opcao.id === valor)),
          'Desative valores ou características vinculados; não os remova.');
        }
      }
    }

    const campos = {
      ...produto,
      preco: anterior?.preco || 0,
      destaque: Number(produto.destaque),
      galeria: JSON.stringify(produto.galeria),
      caracteristicas: JSON.stringify(produto.caracteristicas),
      tiragens: JSON.stringify(produto.tiragens),
      atualizado_em: new Date().toISOString(),
    };
    const chaves = Object.keys(campos);
    if (id) {
      banco.prepare(`UPDATE produtos SET ${chaves.map((chave) => `${chave} = ?`).join(', ')} WHERE id = ?`)
        .run(...Object.values(campos), id);
    } else {
      id = Number(banco.prepare(`INSERT INTO produtos (${chaves.join(', ')}) VALUES (${chaves.map(() => '?').join(', ')})`)
        .run(...Object.values(campos)).lastInsertRowid);
    }

    banco.prepare('UPDATE variacoes SET ativa = 0 WHERE produto_id = ?').run(id);
    for (const variacao of variacoes) {
      const parametros = [JSON.stringify(variacao.opcoes), variacao.assinatura, variacao.quantidade,
        variacao.total_centavos, variacao.codigo, variacao.disponivel, variacao.ativa];
      if (variacao.id) {
        exigir(banco.prepare('SELECT id FROM variacoes WHERE id = ? AND produto_id = ?').get(variacao.id, id),
          'A combinação não pertence a este produto.');
        banco.prepare(`UPDATE variacoes SET opcoes = ?, assinatura = ?, quantidade = ?, total_centavos = ?,
          codigo = ?, disponivel = ?, ativa = ?, unitario_centavos = ?, aproximado = ? WHERE id = ? AND produto_id = ?`)
          .run(...parametros, variacao.unitario_centavos, variacao.aproximado, variacao.id, id);
      } else {
        banco.prepare(`INSERT INTO variacoes (opcoes, assinatura, quantidade, total_centavos, codigo,
          disponivel, ativa, unitario_centavos, aproximado, produto_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(...parametros, variacao.unitario_centavos, variacao.aproximado, id);
      }
    }
    registrar(usuario, anterior ? 'Editou rascunho do produto' : 'Criou produto em rascunho', 'produto', id);
    return obterProduto(id);
  });
}

function alterarEstado(id, acao, usuario) {
  const produto = obterProduto(id);
  if (acao === 'publicar') {
    exigir(produto.estado !== 'arquivado', 'Restaure o produto antes de publicar.');
    const avisos = pendencias(produto);
    exigir(!avisos.length, `Complete antes de publicar: ${avisos.join('; ')}.`);
    banco.prepare("UPDATE produtos SET estado = 'publicado', publicado_json = ? WHERE id = ?")
      .run(JSON.stringify(apresentarProduto(produto)), id);
  } else if (acao === 'arquivar') {
    banco.prepare("UPDATE produtos SET estado = 'arquivado' WHERE id = ?").run(id);
  } else if (acao === 'restaurar' || acao === 'rascunho') {
    banco.prepare("UPDATE produtos SET estado = 'rascunho' WHERE id = ?").run(id);
  } else exigir(false, 'Ação de catálogo inválida.');
  registrar(usuario, acao, 'produto', id);
  return obterProduto(id);
}

function excluirProduto(id, usuario) {
  return transacao(() => {
    obterProduto(id);
    banco.prepare('DELETE FROM variacoes WHERE produto_id = ?').run(id);
    banco.prepare('DELETE FROM produtos WHERE id = ?').run(id);
    registrar(usuario, 'Excluiu produto definitivamente', 'produto', id);
  });
}

module.exports = {
  imagem, obterProduto, pendencias, apresentarProduto, listarPublicos, salvarProduto, alterarEstado, excluirProduto,
};
