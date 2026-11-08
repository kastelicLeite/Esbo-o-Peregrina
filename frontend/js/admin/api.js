let acesso;

export async function requisitar(caminho, opcoes = {}) {
  const headers = { ...opcoes.headers };
  let body = opcoes.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  if (opcoes.method && opcoes.method !== 'GET' && acesso) headers['X-CSRF-Token'] = acesso.csrf;
  const resposta = await fetch(caminho, { ...opcoes, body, headers, cache: 'no-store' });
  if (resposta.status === 401 && !caminho.endsWith('/entrar')) {
    window.location.assign('/paginas/entrar.html');
    throw new Error('Sua sessão terminou. Entre novamente.');
  }
  if (resposta.status === 204) return null;
  const dados = await resposta.json();
  if (dados.codigo === 'SENHA_TABELAS') {
    window.location.assign('/paginas/acesso-painel.html?destino=banco');
    throw new Error(dados.erro);
  }
  if (dados.codigo === 'SENHA_PAINEL') {
    window.location.assign('/paginas/acesso-painel.html');
    throw new Error(dados.erro);
  }
  if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir a operação.');
  return dados;
}

export async function iniciarSessao() {
  acesso = await requisitar('/api/acesso/sessao');
  return acesso;
}

export function usuarioAtual() {
  return acesso?.usuario;
}

export async function exportarCatalogo() {
  const resposta = await fetch('/api/admin/exportar', { cache: 'no-store' });
  if (!resposta.ok) throw new Error('Não foi possível exportar o catálogo.');
  const url = URL.createObjectURL(await resposta.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'catalogo-peregrina.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
