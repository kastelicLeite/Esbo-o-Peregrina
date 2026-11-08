export function identificarId(busca) {
  const resultado = String(busca || '').trim().match(/^(?:id\s*[:#]?\s*|#\s*)?(\d+)$/i);
  if (!resultado) return null;
  const id = Number(resultado[1]);
  return Number.isSafeInteger(id) ? id : -1;
}

export function filtrarIdExato(produtos, id) {
  return id === null ? produtos : produtos.filter((produto) => produto.id === id);
}
