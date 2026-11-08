export async function validarItens(itens) {
  const resposta = await fetch('/api/orcamento/validar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itens }), cache: 'no-store',
  });
  let dados;
  try { dados = await resposta.json(); } catch {
    throw new Error('Não foi possível consultar o catálogo. Reinicie o servidor e tente novamente.');
  }
  if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível conferir o orçamento.');
  return dados;
}
