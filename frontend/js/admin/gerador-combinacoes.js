import { elemento, campo, botao } from './interface.js';

export function gerarCombinacoes(grupos, tiragens, existentes) {
  if (!tiragens.length || grupos.some((grupo) => !grupo.valores.length)) {
    throw new Error('Marque pelo menos um valor de cada característica e uma tiragem.');
  }
  const total = grupos.reduce((n, grupo) => n * grupo.valores.length, tiragens.length);
  if (total > 500) throw new Error('Selecione menos opções: o limite é 500 combinações.');
  let escolhas = [{}];
  for (const grupo of grupos) {
    escolhas = escolhas.flatMap((opcoes) => grupo.valores.map((id) => ({ ...opcoes, [grupo.id]: id })));
  }
  const chave = (item) => JSON.stringify([item.quantidade, Object.entries(item.opcoes).sort(([a], [b]) => a.localeCompare(b))]);
  const chaves = new Set(existentes.map(chave));
  const novas = escolhas.flatMap((opcoes) => tiragens.map((quantidade) => ({
    opcoes, quantidade, total: '', unitario: '', codigo: '', ativa: true, disponivel: true,
  }))).filter((item) => !chaves.has(chave(item)));
  if (novas.length + existentes.length > 500) throw new Error('O produto pode ter até 500 combinações.');
  return novas;
}

export function editorGerador(estado, aoGerar) {
  const raiz = elemento('details', { className: 'bloco-opcao' });
  raiz.append(elemento('summary', {}, 'Adicionar combinações em grupo'));
  raiz.append(elemento('p', {}, 'Marque somente os valores compatíveis entre si. O sistema combina as escolhas com as tiragens marcadas, sem repetir ou alterar os preços existentes. Repita para outro grupo de compatibilidade.'));
  const grupos = estado.produto.caracteristicas.filter((item) => item.ativo && item.tipo === 'selecao').map((item) => {
    const bloco = elemento('fieldset', {}, elemento('legend', {}, item.nome));
    const entradas = item.valores.filter((valor) => valor.ativo).map((valor) => {
      const node = campo(valor.nome, '', false, 'checkbox');
      bloco.append(node);
      return { id: valor.id, entrada: node.querySelector('input') };
    });
    raiz.append(bloco);
    return { id: item.id, entradas };
  });
  const bloco = elemento('fieldset', {}, elemento('legend', {}, 'Tiragens'));
  const tiragens = estado.produto.tiragens.map((valor) => {
    const node = campo(`${valor.toLocaleString('pt-BR')} unidades`, '', false, 'checkbox');
    bloco.append(node);
    return { valor, entrada: node.querySelector('input') };
  });
  raiz.append(bloco, botao('Criar combinações selecionadas', () => {
    const novas = gerarCombinacoes(grupos.map((grupo) => ({
      id: grupo.id, valores: grupo.entradas.filter((item) => item.entrada.checked).map((item) => item.id),
    })), tiragens.filter((item) => item.entrada.checked).map((item) => item.valor), estado.produto.variacoes);
    estado.produto.variacoes.push(...novas);
    aoGerar();
  }));
  return raiz;
}
