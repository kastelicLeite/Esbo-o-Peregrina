export function normalizarPesquisa(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function distancia(a, b) {
  const linhas = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i += 1) linhas[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) linhas[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      linhas[i][j] = Math.min(
        linhas[i - 1][j] + 1,
        linhas[i][j - 1] + 1,
        linhas[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        linhas[i][j] = Math.min(linhas[i][j], linhas[i - 2][j - 2] + 1);
      }
    }
  }
  return linhas[a.length][b.length];
}

function custoPalavra(termo, palavra) {
  if (termo === palavra) return 0;
  if (palavra.startsWith(termo)) return 1;
  // Termos curtos exigem correspondência exata ou início da palavra.
  const limite = termo.length >= 7 ? 2 : termo.length >= 4 ? 1 : 0;
  if (!limite || Math.abs(termo.length - palavra.length) > limite) return Infinity;
  const erros = distancia(termo, palavra);
  return erros <= limite ? 2 + erros : Infinity;
}

export function pesquisarProdutos(produtos, consulta) {
  const termos = normalizarPesquisa(consulta).split(' ').filter(Boolean).slice(0, 20);
  if (!termos.length) return produtos.slice();
  return produtos.map((produto, indice) => {
    const nome = normalizarPesquisa(produto.nome).split(' ');
    const detalhes = normalizarPesquisa(`${produto.categoria || ''} ${produto.descricao || ''}`).split(' ');
    let pontos = 0;
    for (const termo of termos) {
      let melhor = Infinity;
      for (const palavra of nome) melhor = Math.min(melhor, custoPalavra(termo, palavra));
      for (const palavra of detalhes) melhor = Math.min(melhor, custoPalavra(termo, palavra) + 5);
      pontos += melhor;
    }
    return { produto, pontos, indice };
  }).filter((item) => Number.isFinite(item.pontos))
    .sort((a, b) => a.pontos - b.pontos || a.indice - b.indice)
    .map((item) => item.produto);
}
