import { elemento, campo, controlar, botao } from './interface.js';
import { editorGerador } from './gerador-combinacoes.js';

export function editorVariacoes(estado, configuracao = {}) {
  const raiz = elemento('div');

  function desenhar() {
    raiz.replaceChildren();
    raiz.append(editorGerador(estado, desenhar));
    if (!estado.produto.variacoes.length) {
      raiz.append(elemento('p', { className: 'explicacao-etapa' },
        'Clique em “Adicionar opção de venda” e preencha as escolhas e a quantidade. É necessário ter pelo menos uma opção de venda para publicar.'));
    }
    estado.produto.variacoes.forEach((item, indice) => {
      const bloco = elemento('fieldset', { className: 'bloco-opcao' }, [
        elemento('legend', {}, `Opção de venda ${indice + 1}`),
      ]);
      for (const caracteristica of estado.produto.caracteristicas.filter((campo) => campo.tipo === 'selecao')) {
        bloco.append(controlar(campo(caracteristica.nome || 'Característica sem nome', '',
          item.opcoes[caracteristica.id] || '', 'select', [
            { valor: '', nome: 'Não selecionar' },
            ...caracteristica.valores.map((valor) => ({
              valor: valor.id, nome: `${valor.nome || 'Valor sem nome'}${!valor.ativo || !caracteristica.ativo ? ' (inativo)' : ''}`,
            })),
          ]), (valor) => {
          if (valor) item.opcoes[caracteristica.id] = valor;
          else delete item.opcoes[caracteristica.id];
        }));
      }
      bloco.append(controlar(campo('Quantidade de unidades', '', item.quantidade, 'number'), (valor) => {
        item.quantidade = Number(valor);
      }));
      if (estado.produto.comercial === 'preco') {
        bloco.append(controlar(campo('Preço aproximado (calculado)', '', item.aproximado, 'checkbox'),
          (valor) => { item.aproximado = valor; }));
        bloco.append(controlar(campo('Preço por unidade informado (R$)', '', item.unitario || '', 'text', [],
          'Opcional. Use o valor informado na referência. Ele pode ter arredondamento diferente do total do lote.'),
        (valor) => { item.unitario = valor; }));
        bloco.append(controlar(campo('Preço total deste lote (R$)', '', item.total || '', 'text', [],
          'Informe o valor de todas as unidades juntas. Deixe vazio para mostrar esta combinação como “Sob orçamento”.'), (valor) => { item.total = valor; }));
      }
      bloco.append(
        controlar(campo('Código para identificar esta opção (opcional)', '', item.codigo || ''), (valor) => { item.codigo = valor; }),
        controlar(campo('Disponível para pedidos', '', item.disponivel, 'checkbox'), (valor) => { item.disponivel = valor; }),
        controlar(campo('Usar esta opção de venda', '', item.ativa, 'checkbox'), (valor) => { item.ativa = valor; }),
      );
      if (!item.id) bloco.append(botao('Remover esta opção de venda', () => {
        estado.produto.variacoes.splice(indice, 1);
        desenhar();
      }));
      if (configuracao.compacto) {
        const nomes = estado.produto.caracteristicas.filter((campo) => campo.tipo === 'selecao')
          .map((campo) => campo.valores.find((valor) => valor.id === item.opcoes[campo.id])?.nome || 'Escolher opção');
        nomes.push(`${item.quantidade} un.`);
        raiz.append(elemento('details', { className: 'grupo-painel-previa', open: configuracao.selecionado === indice }, [
          elemento('summary', {}, nomes.join(' · ')), bloco,
        ]));
      } else raiz.append(bloco);
    });
    raiz.append(botao('Adicionar opção de venda', () => {
      const opcoes = {};
      for (const item of estado.produto.caracteristicas.filter((campo) => campo.ativo && campo.tipo === 'selecao')) {
        const valor = item.valores.find((entrada) => entrada.ativo);
        if (valor) opcoes[item.id] = valor.id;
      }
      estado.produto.variacoes.push({
        opcoes, quantidade: estado.produto.tiragens[0] || 1, total: '', codigo: '', disponivel: true, ativa: true,
      });
      desenhar();
    }));
  }

  desenhar();
  return { raiz, desenhar };
}
