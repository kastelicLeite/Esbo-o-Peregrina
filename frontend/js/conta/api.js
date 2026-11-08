let csrf;

export async function requisitar(rota, dados, metodo = 'POST') {
  const resposta = await fetch(`/api/conta/${rota}`, {
    method: dados === undefined ? 'GET' : metodo,
    headers: {
      ...(dados === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    body: dados === undefined ? undefined : JSON.stringify(dados),
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (resposta.status === 204) return null;
  const resultado = await resposta.json();
  if (!resposta.ok) {
    const erro = new Error(resultado.erro || 'Não foi possível continuar. Tente novamente.');
    erro.status = resposta.status;
    throw erro;
  }
  if (resultado.csrf) csrf = resultado.csrf;
  return resultado;
}
