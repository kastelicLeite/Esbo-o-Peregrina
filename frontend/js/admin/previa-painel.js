import { elemento, campo, controlar, botao, mover } from './interface.js';
import { selecionarMidia } from './midias.js';
import { editorCaracteristicas } from './caracteristicas.js';
import { editorVariacoes } from './variacoes.js';
import { editarCompatibilidade } from './compatibilidade-produto.js';

export function preencherPainel({ destino, secao, selecionado, estado, categorias, simulacao, alterar }) {
  const produto = estado.produto;
  destino.replaceChildren();
  const titulos = { apresentacao: 'Apresentação', imagens: 'Imagens', caracteristicas: 'Características e opções',
    tiragens: 'Tiragens', precos: 'Preços e compatibilidade' };
  destino.append(elemento('h3', {}, titulos[secao]));
  const editar = (rotulo, chave, tipo = 'text', opcoes = []) => controlar(
    campo(rotulo, '', produto[chave], tipo, opcoes), (valor) => { produto[chave] = valor; alterar(); });
  function redesenhar() {
    preencherPainel({ destino, secao, selecionado, estado, categorias, simulacao, alterar });
  }

  if (secao === 'apresentacao') {
    destino.append(editar('Nome do produto', 'nome'), editar('Descrição', 'descricao', 'textarea'),
      editar('Categoria', 'categoria_id', 'select', [{ valor: '', nome: 'Selecione' },
        ...categorias.map((item) => ({ valor: item.id, nome: item.nome }))]));
    const estoque = editar('Estoque (unidades)', 'estoque', 'number');
    estoque.querySelector('input').max = '10000000';
    estoque.querySelector('input').placeholder = 'Sem controle';
    destino.append(estoque, elemento('p', {}, 'Deixe o estoque vazio para não controlar. O valor é interno do painel.'));
    destino.querySelector('input').maxLength = 150;
    destino.querySelector('textarea').maxLength = 3000;
  }

  if (secao === 'imagens') {
    const lista = elemento('ol', { className: 'imagens-painel-previa' });
    const ids = [produto.imagem_id, ...produto.galeria].filter(Boolean)
      .filter((id, indice, todos) => todos.indexOf(id) === indice);
    function ordenar(novos) {
      produto.imagem_id = novos[0] || '';
      produto.galeria = novos.slice(1);
      alterar();
      redesenhar();
    }
    ids.forEach((id, indice) => {
      const imagem = estado.midias.find((item) => item.id === id);
      const subir = botao('Subir', () => { mover(ids, indice, -1); ordenar(ids); });
      const descer = botao('Descer', () => { mover(ids, indice, 1); ordenar(ids); });
      subir.disabled = indice === 0;
      descer.disabled = indice === ids.length - 1;
      lista.append(elemento('li', {}, [
        elemento('img', { src: imagem?.miniatura_url || imagem?.url || '', alt: imagem?.alternativo || 'Imagem do produto' }),
        elemento('p', {}, indice === 0 ? 'Capa' : `Foto ${indice + 1}`),
        elemento('div', { className: 'acoes-linha' }, [subir, descer,
          botao('Remover', () => ordenar(ids.filter((item) => item !== id))),
        ]),
      ]));
    });
    destino.append(elemento('p', {}, 'A primeira imagem é a capa. Imagens vinculadas às opções continuam aparecendo ao selecionar a configuração correspondente.'), lista,
      botao('Adicionar imagem da biblioteca', async () => {
        const imagem = await selecionarMidia();
        if (!imagem) return;
        if (!estado.midias.some((item) => item.id === imagem.id)) estado.midias.push(imagem);
        if (ids.includes(imagem.id)) return;
        if (ids.length >= 21) throw new Error('Use uma capa e até 20 imagens na galeria.');
        ordenar([...ids, imagem.id]);
      }));
  }

  if (secao === 'caracteristicas') {
    destino.append(elemento('p', {}, 'Organize as características e as opções com os controles Subir e Descer. Desative opções em uso para preservar seus vínculos.'));
    const editor = editorCaracteristicas(estado, alterar, { compacto: true, selecionado });
    destino.append(editor.raiz);
  }

  if (secao === 'tiragens') {
    destino.append(elemento('p', {}, 'A ordem abaixo é usada no seletor público. Ao trocar uma quantidade, as combinações dessa tiragem acompanham a alteração; confira seus preços.'));
    const lista = elemento('ol', { className: 'tiragens-painel-previa' });
    const erro = elemento('p', { className: 'erro-formulario', role: 'alert' });
    produto.tiragens.forEach((quantidade, indice) => {
      const entrada = campo(`Tiragem ${indice + 1}`, '', quantidade, 'number');
      const input = entrada.querySelector('input');
      input.min = '1';
      input.max = '10000000';
      input.addEventListener('change', () => {
        const nova = Number(input.value);
        if (!Number.isSafeInteger(nova) || nova < 1 || nova > 10000000
          || produto.tiragens.some((item, posicao) => posicao !== indice && item === nova)
          || produto.variacoes.some((item) => item.quantidade === nova && nova !== quantidade)) {
          erro.textContent = 'Use uma quantidade inteira, sem repetir uma tiragem ou combinação existente.';
          return;
        }
        produto.variacoes.forEach((item) => { if (item.quantidade === quantidade) item.quantidade = nova; });
        produto.tiragens[indice] = nova;
        alterar();
        redesenhar();
      });
      lista.append(elemento('li', {}, [entrada, elemento('div', { className: 'acoes-linha' }, [
        botao('Subir', () => { mover(produto.tiragens, indice, -1); alterar(); redesenhar(); }),
        botao('Descer', () => { mover(produto.tiragens, indice, 1); alterar(); redesenhar(); }),
        botao('Remover', () => { produto.tiragens.splice(indice, 1); alterar(); redesenhar(); }),
      ])]));
    });
    const nova = campo('Nova quantidade de unidades', '', '', 'number');
    destino.append(lista, nova, erro, botao('Adicionar tiragem', () => {
      const valor = Number(nova.querySelector('input').value);
      if (!Number.isSafeInteger(valor) || valor < 1 || valor > 10000000 || produto.tiragens.includes(valor)) {
        erro.textContent = 'Informe uma quantidade inteira entre 1 e 10.000.000, sem repetir tiragens.';
        return;
      }
      if (produto.tiragens.length >= 50) { erro.textContent = 'Use até 50 tiragens.'; return; }
      produto.tiragens.push(valor);
      alterar();
      redesenhar();
    }), elemento('p', {}, 'Depois, habilite as combinações da nova tiragem em Preços e compatibilidade.'));
  }

  if (secao === 'precos') {
    const variacoes = elemento('div');
    function atualizarVariacoes() {
      const indice = produto.variacoes.findIndex((item) => item.quantidade === simulacao.quantidade
        && Object.entries(simulacao.opcoes).every(([chave, valor]) => item.opcoes[chave] === valor));
      variacoes.replaceChildren(editorVariacoes(estado, { compacto: true, selecionado: indice }).raiz);
    }
    destino.append(editar('Como apresentar os valores', 'comercial', 'select', [
      { valor: 'preco', nome: 'Mostrar preços cadastrados' }, { valor: 'orcamento', nome: 'Sob orçamento' },
    ]));
    destino.querySelector('select').addEventListener('change', redesenhar);
    const campos = produto.caracteristicas.filter((item) => item.ativo && item.tipo === 'selecao')
      .map((item) => ({ ...item, valores: item.valores.filter((valor) => valor.ativo) }));
    if (campos.length) {
      const compatibilidade = elemento('details', { className: 'grupo-painel-previa' },
        elemento('summary', {}, 'Editar combinações permitidas'));
      const escolha = campo('Organizar compatibilidade por', '', selecionado || campos[0].id, 'select',
        campos.map((item) => ({ valor: item.id, nome: item.nome })));
      const corpo = elemento('div');
      function montar() {
        const principal = campos.find((item) => item.id === escolha.querySelector('select').value) || campos[0];
        editarCompatibilidade({ dados: produto, caracteristicas: campos, principal,
          selecionado: simulacao.opcoes[principal.id], destino: corpo, aoAplicar: () => {
            atualizarVariacoes();
            alterar();
          } });
      }
      escolha.querySelector('select').addEventListener('change', montar);
      compatibilidade.append(escolha, corpo);
      montar();
      destino.append(compatibilidade);
    }
    atualizarVariacoes();
    destino.append(variacoes);
  }
}
