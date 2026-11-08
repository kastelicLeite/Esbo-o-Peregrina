const chave = 'peregrina:historico:visitante:v1';
const limites = { pesquisa: 50, visualizacao: 100, orcamento: 30 };
const prazo = 90 * 86400000;
let falhaLocal = false;
const sessao = fetch('/api/conta/sessao', { cache: 'no-store' }).then(async resposta => {
  if (resposta.status === 401) return null;
  if (!resposta.ok) throw new Error('Não foi possível consultar sua conta. Tente novamente.');
  return resposta.json();
});
sessao.catch(() => {});

function lerLocal() {
  let dados;
  let salvo;
  try { salvo = localStorage.getItem(chave); }
  catch { throw new Error('Não foi possível ler o histórico deste navegador. Confira as permissões de armazenamento.'); }
  try { dados = JSON.parse(salvo || '{"ativo":true,"eventos":[]}'); }
  catch { dados = {}; falhaLocal = true; }
  if (!dados || typeof dados !== 'object') { dados = {}; falhaLocal = true; }
  const eventos = Array.isArray(dados.eventos) ? dados.eventos.filter(item => Object.hasOwn(limites, item?.tipo)
    && item.dados && typeof item.dados === 'object' && Number.isSafeInteger(item.criado_em)
    && (item.tipo !== 'pesquisa' || typeof item.dados.termo === 'string')
    && (item.tipo !== 'visualizacao' || (Number.isSafeInteger(item.dados.produto_id) && typeof item.dados.slug === 'string'))
    && (item.tipo !== 'orcamento' || (Array.isArray(item.dados.itens) && item.dados.itens.length <= 50
      && item.dados.itens.every(produto => produto && Array.isArray(produto.especificacoes))))
    && item.criado_em > Date.now() - prazo && item.criado_em <= Date.now() + 60000).slice(0, 180) : [];
  return { ativo: dados.ativo !== false, eventos, origem: 'navegador', falha: falhaLocal };
}

async function requisitar(method, dados, caminho = '') {
  const acesso = await sessao;
  if (!acesso) return null;
  const body = dados === undefined ? undefined : JSON.stringify(dados);
  const resposta = await fetch('/api/conta/historico' + caminho, { method, cache: 'no-store',
    keepalive: method === 'POST' && new TextEncoder().encode(body || '').length < 60000,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': acesso.csrf },
    body,
  });
  if (!resposta.ok) throw new Error('Não foi possível atualizar seu histórico. Entre novamente ou tente mais tarde.');
  return resposta.status === 204 ? {} : resposta.json();
}

export async function lerHistorico() {
  const acesso = await sessao;
  return acesso ? requisitar('GET') : lerLocal();
}

export async function registrarAtividade(tipo, entrada) {
  try {
    if (!Object.hasOwn(limites, tipo)) return;
    if (tipo === 'pesquisa' && String(entrada.termo || '').trim().length < 2) return;
    const acesso = await sessao;
    if (acesso) {
      const dados = tipo === 'visualizacao' ? { produto_id: entrada.produto.id }
        : tipo === 'orcamento' ? { itens: entrada.itens, origem: entrada.origem } : { termo: entrada.termo };
      return await requisitar('POST', { tipo, ...dados });
    }
    const historico = lerLocal();
    if (!historico.ativo) return { salvo: false };
    let dados;
    let assinatura;
    if (tipo === 'pesquisa') {
      const termo = entrada.termo.trim().replace(/\s+/g, ' ').slice(0, 180);
      if (termo.length < 2) return;
      dados = { termo };
      assinatura = termo.normalize('NFKC').toLocaleLowerCase('pt-BR');
    } else if (tipo === 'visualizacao') {
      const produto = entrada.produto;
      dados = { produto_id: produto.id, nome: produto.nome, slug: produto.slug, categoria_id: produto.categoria_id };
      assinatura = String(produto.id);
    } else {
      const resumo = entrada.resumo;
      if (!resumo?.pode_enviar) return;
      dados = { estado: 'preparado', itens: resumo.itens.map(item => ({ produto_id: item.produto_id,
        nome: item.nome, slug: item.slug, quantidade: item.quantidade, opcoes: item.opcoes,
        especificacoes: item.especificacoes, total_centavos: item.total_centavos, aproximado: item.aproximado })),
      subtotal_centavos: resumo.subtotal_centavos, sob_orcamento: resumo.sob_orcamento };
      assinatura = JSON.stringify(dados);
    }
    const novos = [{ id: crypto.randomUUID(), tipo, dados, assinatura, criado_em: Date.now() },
      ...historico.eventos.filter(item => item.tipo !== tipo || item.assinatura !== assinatura)];
    const contagem = {};
    historico.eventos = novos.filter(item => (contagem[item.tipo] = (contagem[item.tipo] || 0) + 1) <= limites[item.tipo]);
    while (historico.eventos.length > 1 && JSON.stringify(historico).length > 1000000) historico.eventos.pop();
    localStorage.setItem(chave, JSON.stringify(historico));
    return { salvo: true };
  } catch { falhaLocal = true; return { salvo: false }; }
}

export async function limparHistorico(tipo) {
  if (await sessao) return requisitar('DELETE', tipo ? { tipo } : {});
  const historico = lerLocal();
  historico.eventos = tipo ? historico.eventos.filter(item => item.tipo !== tipo) : [];
  localStorage.setItem(chave, JSON.stringify(historico));
  falhaLocal = false;
}

export async function configurarHistorico(ativo) {
  if (await sessao) return requisitar('PUT', { ativo }, '/preferencia');
  const historico = lerLocal();
  localStorage.setItem(chave, JSON.stringify({ ...historico, ativo }));
}
