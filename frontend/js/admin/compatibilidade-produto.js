import { elemento, campo, botao, dialogo } from './interface.js';
import { gerarCombinacoes } from './gerador-combinacoes.js';

export function chaveCompatibilidade(item) {
  return JSON.stringify([item.quantidade, Object.entries(item.opcoes).sort(([a], [b]) => a.localeCompare(b))]);
}

export function aplicarCompatibilidades(variacoes, alteracoes) {
  const resultado = structuredClone(variacoes);
  for (const { item, permitido } of alteracoes) {
    const existente = resultado.find((valor) => chaveCompatibilidade(valor) === chaveCompatibilidade(item));
    if (existente) {
      existente.disponivel = permitido;
      if (permitido) existente.ativa = true;
    } else if (permitido) resultado.push({ ...structuredClone(item), ativa: true, disponivel: true });
  }
  if (resultado.length > 500) throw new Error('O produto pode ter até 500 combinações. Desmarque algumas opções.');
  return resultado;
}

export function editarCompatibilidade({ dados, caracteristicas, principal, selecionado, aoAplicar, destino }) {
  const conteudo = elemento('div');
  const seletor = campo(principal.nome, '', selecionado || principal.valores[0]?.id || '', 'select',
    principal.valores.map((item) => ({ valor: item.id, nome: item.nome })));
  const entrada = seletor.querySelector('select');
  const lista = elemento('div', { className: 'lista-compatibilidade' });
  const aviso = elemento('p', { role: 'status' });
  const alteracoes = new Map();
  conteudo.append(elemento('p', {}, 'Marque as combinações permitidas. Desmarcar preserva o preço cadastrado. Novas combinações ficam sob orçamento até receberem um preço.'), seletor, aviso, lista);
  const erroLocal = elemento('p', { className: 'erro-formulario', role: 'alert' });
  conteudo.append(erroLocal);
  const janela = destino ? null : dialogo(`Editar compatibilidade de ${principal.nome}`, conteudo);
  if (destino) destino.replaceChildren(conteudo);
  function desenhar() {
    lista.replaceChildren();
    try {
      const grupos = caracteristicas.filter((item) => item.tipo === 'selecao').map((item) => ({
        id: item.id, valores: item.id === principal.id ? [entrada.value] : item.valores.map((valor) => valor.id),
      }));
      const candidatas = gerarCombinacoes(grupos, dados.tiragens, []);
      aviso.textContent = destino ? 'Marque ou desmarque para atualizar a prévia imediatamente.'
        : 'As alterações só serão aplicadas ao confirmar abaixo.';
      for (const item of candidatas) {
        const chave = chaveCompatibilidade(item);
        const existente = dados.variacoes.find((variacao) => chaveCompatibilidade(variacao) === chave);
        const nomes = caracteristicas.filter((campo) => campo.tipo === 'selecao').map((campo) =>
          `${campo.nome}: ${campo.valores.find((valor) => valor.id === item.opcoes[campo.id])?.nome}`);
        nomes.push(`${item.quantidade.toLocaleString('pt-BR')} unidades`);
        const controle = campo(nomes.join(' · '), '', alteracoes.get(chave)?.permitido
          ?? Boolean(existente?.ativa && existente?.disponivel), 'checkbox');
        controle.querySelector('input').addEventListener('change', (evento) => {
          alteracoes.set(chave, { item, permitido: evento.target.checked });
          if (destino) aplicar();
        });
        lista.append(controle);
      }
    } catch (erro) { aviso.textContent = erro.message; }
  }
  function aplicar() {
    try {
      const novas = aplicarCompatibilidades(dados.variacoes, [...alteracoes.values()]);
      dados.variacoes = novas;
      aoAplicar(dados);
      erroLocal.textContent = '';
      janela?.dialog.close();
    } catch (erro) { (janela?.erro || erroLocal).textContent = erro.message; }
  }
  if (!destino) conteudo.append(botao('Aplicar compatibilidade na prévia', aplicar));
  entrada.addEventListener('change', desenhar);
  desenhar();
}
