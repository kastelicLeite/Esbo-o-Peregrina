const chaveArmazenamento = 'peregrina:orcamento:v1';

export function chaveConfiguracao(item) {
  return JSON.stringify([item.produto_id, item.quantidade,
    Object.entries(item.opcoes).sort(([a], [b]) => a.localeCompare(b))]);
}

function limparItem(item) {
  if (!item || !Number.isSafeInteger(item.produto_id) || item.produto_id < 1
    || !Number.isSafeInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 10000000
    || !item.opcoes || typeof item.opcoes !== 'object' || Array.isArray(item.opcoes)) return null;
  const entradas = Object.entries(item.opcoes);
  if (entradas.length > 20 || !entradas.every(([chave, valor]) => /^[a-zA-Z0-9-]{1,80}$/.test(chave)
    && typeof valor === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(valor))) return null;
  return {
    id: typeof item.id === 'string' ? item.id.slice(0, 80) : crypto.randomUUID(),
    produto_id: item.produto_id, opcoes: Object.fromEntries(entradas), quantidade: item.quantidade,
    referencia: {
      nome: String(item.referencia?.nome || 'Produto').slice(0, 150),
      imagem: typeof item.referencia?.imagem === 'string' && item.referencia.imagem.startsWith('/midias/')
        ? item.referencia.imagem : '',
      total_centavos: Number.isSafeInteger(item.referencia?.total_centavos) ? item.referencia.total_centavos : null,
    },
  };
}

export function criarCarrinho(armazenamento, aoAlterar = () => {}) {
  let itens = [];
  let falhaLeitura = false;
  function restaurar() {
    try {
      const dados = JSON.parse(armazenamento.getItem(chaveArmazenamento) || '[]');
      if (!Array.isArray(dados)) throw new Error('Formato inválido.');
      const vistos = new Set();
      itens = dados.slice(0, 50).map(limparItem).filter(Boolean).filter((item) => {
        const chave = chaveConfiguracao(item);
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
      falhaLeitura = false;
    } catch { falhaLeitura = true; }
  }
  restaurar();
  function gravar(novos) {
    try { armazenamento.setItem(chaveArmazenamento, JSON.stringify(novos)); }
    catch { throw new Error('Não foi possível guardar o carrinho. Libere o armazenamento deste navegador e tente novamente.'); }
    itens = novos;
    aoAlterar();
  }
  return {
    ler: () => structuredClone(itens),
    falhaLeitura: () => falhaLeitura,
    restaurar,
    adicionar(entrada, substituirId) {
      const item = limparItem(entrada);
      if (!item) throw new Error('Confira as opções e a quantidade antes de adicionar.');
      if (substituirId && !itens.some((outro) => outro.id === substituirId)) {
        throw new Error('Este item foi removido do orçamento. Volte ao carrinho e tente novamente.');
      }
      const igual = itens.find((outro) => outro.id !== substituirId && chaveConfiguracao(outro) === chaveConfiguracao(item));
      if (igual) {
        if (substituirId) gravar(itens.filter((outro) => outro.id !== substituirId));
        return { duplicado: true };
      }
      if (!substituirId && itens.length >= 50) throw new Error('Seu orçamento pode ter até 50 configurações.');
      if (substituirId) item.id = substituirId;
      gravar(substituirId ? itens.map((outro) => outro.id === substituirId ? item : outro) : [...itens, item]);
      return { duplicado: false };
    },
    remover: (id) => gravar(itens.filter((item) => item.id !== id)),
    limpar: () => gravar([]),
  };
}

let armazenamento;
try { armazenamento = globalThis.localStorage; } catch {}
export const carrinho = criarCarrinho(armazenamento, () => {
  globalThis.dispatchEvent?.(new Event('orcamento-alterado'));
});
globalThis.addEventListener?.('storage', (evento) => {
  if (evento.key === chaveArmazenamento || evento.key === null) {
    carrinho.restaurar();
    globalThis.dispatchEvent(new Event('orcamento-alterado'));
  }
});
