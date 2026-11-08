export function selecionarRelacionados(produto, catalogo, limite = 4) {
  const materiais = (item) => (item.caracteristicas || [])
    .filter((campo) => campo.id === 'material' || campo.nome?.toLocaleLowerCase('pt-BR') === 'material')
    .flatMap((campo) => campo.tipo === 'fixa' ? [campo.valor] : campo.valores.map((valor) => valor.nome));
  const referencias = new Set(materiais(produto));
  const vistos = new Set([produto.id]);
  return catalogo.filter((item) => {
    if (vistos.has(item.id)) return false;
    vistos.add(item.id);
    return true;
  }).map((item, indice) => ({
    item, indice,
    pontos: (item.categoria_id === produto.categoria_id ? 100 : 0)
      + (materiais(item).some((valor) => referencias.has(valor)) ? 20 : 0),
  })).sort((a, b) => b.pontos - a.pontos || a.indice - b.indice)
    .slice(0, limite).map(({ item }) => item);
}
