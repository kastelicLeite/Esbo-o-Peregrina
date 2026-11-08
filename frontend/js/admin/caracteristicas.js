import { elemento, campo, controlar, botao, mover } from './interface.js';
import { selecionarMidia } from './midias.js';

export function editorCaracteristicas(estado, aoAlterar, configuracao = {}) {
  const raiz = elemento('div');

  function desenhar() {
    raiz.replaceChildren();
    estado.produto.caracteristicas.forEach((item, indice) => {
      const bloco = elemento('fieldset', { className: 'bloco-opcao' }, [
        elemento('legend', {}, `Característica ${indice + 1}`),
        controlar(campo('Nome da informação ou opção (ex.: Material)', '', item.nome), (valor) => { item.nome = valor; aoAlterar(); }),
        controlar(campo('Como o cliente verá esta informação', '', item.tipo, 'select', [
          { valor: 'fixa', nome: 'Informação pronta, sem escolha do cliente' },
          { valor: 'selecao', nome: 'Opções para o cliente escolher' },
        ]), (valor) => { item.tipo = valor; desenhar(); aoAlterar(); }),
        controlar(campo('Mostrar esta informação no produto', '', item.ativo, 'checkbox'), (valor) => {
          item.ativo = valor;
          aoAlterar();
        }),
      ]);
      if (item.tipo === 'fixa') {
        bloco.append(controlar(campo('Informação exibida (ex.: 8,8 × 4,8 cm)', '', item.valor || ''), (valor) => { item.valor = valor; aoAlterar(); }));
      } else {
        item.valores.forEach((valor, posicao) => {
          bloco.append(elemento('div', { className: 'linha-opcao' }, [
            controlar(campo('Nome da opção (ex.: Couché 250g)', '', valor.nome), (nome) => { valor.nome = nome; aoAlterar(); }),
            controlar(campo('Permitir esta opção', '', valor.ativo, 'checkbox'), (ativo) => { valor.ativo = ativo; aoAlterar(); }),
            botao(valor.imagem_id ? 'Trocar imagem desta opção' : 'Vincular imagem a esta opção', async () => {
              const imagem = await selecionarMidia();
              if (!imagem) return;
              valor.imagem_id = imagem.id;
              if (estado.midias && !estado.midias.some((item) => item.id === imagem.id)) estado.midias.push(imagem);
              desenhar();
              aoAlterar();
            }),
            ...(valor.imagem_id ? [botao('Remover vínculo da imagem', () => {
              valor.imagem_id = null;
              desenhar();
              aoAlterar();
            })] : []),
            botao('Mover opção para cima', () => { mover(item.valores, posicao, -1); desenhar(); aoAlterar(); }),
            botao('Mover opção para baixo', () => { mover(item.valores, posicao, 1); desenhar(); aoAlterar(); }),
            botao('Remover opção sem uso', () => {
              if (estado.produto.variacoes.some((variacao) => variacao.opcoes[item.id] === valor.id)) {
                throw new Error('Este valor está em uso. Desative-o para preservar os vínculos.');
              }
              item.valores.splice(posicao, 1);
              desenhar();
              aoAlterar();
            }),
          ]));
        });
        bloco.append(botao('Adicionar opção', () => {
          item.valores.push({ id: crypto.randomUUID(), nome: '', ativo: true });
          desenhar();
          aoAlterar();
        }));
      }
      bloco.append(elemento('div', { className: 'acoes-linha' }, [
        botao('Subir característica', () => { mover(estado.produto.caracteristicas, indice, -1); desenhar(); aoAlterar(); }),
        botao('Descer característica', () => { mover(estado.produto.caracteristicas, indice, 1); desenhar(); aoAlterar(); }),
        botao('Remover característica sem uso', () => {
          if (estado.produto.variacoes.some((variacao) => Object.hasOwn(variacao.opcoes, item.id))) {
            throw new Error('Esta característica está em uso. Desative-a para preservar os vínculos.');
          }
          estado.produto.caracteristicas.splice(indice, 1);
          desenhar();
          aoAlterar();
        }),
      ]));
      if (configuracao.compacto) {
        const detalhes = elemento('details', { open: configuracao.selecionado === item.id,
          className: 'grupo-painel-previa' }, [elemento('summary', {}, item.nome || `Característica ${indice + 1}`), bloco]);
        detalhes.dataset.caracteristica = item.id;
        raiz.append(detalhes);
      } else raiz.append(bloco);
    });
    raiz.append(botao('Adicionar característica', () => {
      estado.produto.caracteristicas.push({ id: crypto.randomUUID(), nome: '', tipo: 'selecao', valor: '', valores: [], ativo: true });
      desenhar();
      aoAlterar();
    }));
  }

  desenhar();
  return { raiz, desenhar };
}
