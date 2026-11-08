import { normalizarPesquisa } from './pesquisa-produtos.js';

export function valoresCaracteristica(produto, nome) {
  return (produto.caracteristicas || [])
    .filter((item) => normalizarPesquisa(item.nome) === nome)
    .flatMap((item) => item.tipo === 'fixa' ? [item.valor] : item.valores.map((valor) => valor.nome))
    .filter(Boolean);
}

export function precoUnitario(produto) {
  const preco = produto.menor_preco;
  if (preco?.unitario_centavos != null) return preco.unitario_centavos / 100;
  return preco?.quantidade > 0 ? preco.total_centavos / preco.quantidade / 100 : null;
}

export function filtrarCatalogo(produtos, filtros) {
  return produtos.filter((produto) => {
    if (filtros.categoria && String(produto.categoria_id) !== filtros.categoria) return false;
    for (const nome of ['material', 'acabamento']) {
      if (filtros[nome] && !valoresCaracteristica(produto, nome)
        .some((valor) => normalizarPesquisa(valor) === filtros[nome])) return false;
    }
    const preco = precoUnitario(produto);
    if (filtros.tipo === 'preco' && preco === null) return false;
    if (filtros.tipo === 'orcamento' && preco !== null) return false;
    if (filtros.minimo !== '' && (preco === null || preco < Number(filtros.minimo))) return false;
    if (filtros.maximo !== '' && (preco === null || preco > Number(filtros.maximo))) return false;
    return true;
  });
}
