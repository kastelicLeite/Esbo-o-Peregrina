export function criarRascunhoProduto(armazenamento, usuarioId, produtoId) {
  const chave = `peregrina:cadastro-produto:v1:${usuarioId}:${produtoId || 'novo'}`;
  return {
    ler() {
      try {
        const registro = JSON.parse(armazenamento.getItem(chave));
        const dados = registro?.dados;
        if (registro?.versao !== 1 || !dados || typeof dados !== 'object'
          || !['galeria', 'caracteristicas', 'variacoes', 'tiragens'].every((nome) => Array.isArray(dados[nome]))) return null;
        return registro;
      } catch {
        return null;
      }
    },
    gravar(dados, quantidades, baseAtualizado) {
      try {
        armazenamento.setItem(chave, JSON.stringify({
          versao: 1, dados, quantidades, baseAtualizado, salvoEm: new Date().toISOString(),
        }));
        return true;
      } catch {
        return false;
      }
    },
    limpar() {
      try {
        armazenamento.removeItem(chave);
        return true;
      } catch {
        return false;
      }
    },
  };
}
