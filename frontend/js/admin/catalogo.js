import { requisitar, exportarCatalogo, usuarioAtual } from './api.js';
import { criarRascunhoProduto } from './rascunho-produto.js';
import { menuAcoesProduto, usarIcone } from './acoes-produto.js';
import { elemento, campo, titulo, botao, avisar } from './interface.js';
import { abrirEditor } from './editor-produto.js';
import { identificarId, filtrarIdExato } from './pesquisa-id.js';
import { controleEstoque } from './estoque-produto.js';

export async function montar(container, parametros) {
  const categorias = await requisitar('/api/admin/categorias');
  container.replaceChildren(titulo('Produtos e catálogo', 'Rascunhos e itens arquivados ficam fora do catálogo público.'));
  const filtros = elemento('form', { className: 'filtros-admin' }, [
    campo('Pesquisar por nome ou ID', 'busca'),
    campo('Situação', 'estado', parametros.get('estado') || '', 'select', [
      { valor: '', nome: 'Todas' }, { valor: 'rascunho', nome: 'Rascunhos' },
      { valor: 'ativos', nome: 'Não arquivados' },
      { valor: 'publicado', nome: 'Publicados' }, { valor: 'arquivado', nome: 'Arquivados' },
    ]),
    campo('Categoria', 'categoria', parametros.get('categoria') || '', 'select', [
      { valor: '', nome: 'Todas' }, ...categorias.map((item) => ({ valor: item.id, nome: item.nome })),
    ]),
    campo('Estoque', 'estoque', parametros.get('estoque') || '', 'select', [
      { valor: '', nome: 'Todos os estoques' }, { valor: 'zerado', nome: 'Sem estoque' },
      { valor: 'sem-controle', nome: 'Sem controle' },
    ]),
    campo('Revisão', 'revisao', parametros.get('revisao') || '', 'select', [
      { valor: '', nome: 'Todos os cadastros' }, { valor: 'alteracoes', nome: 'Alterações não publicadas' },
      { valor: 'prontos', nome: 'Rascunhos prontos para publicar' }, { valor: 'pendencias', nome: 'Com pendências' },
    ]),
    campo('Ordenação', 'ordem', 'id', 'select', [
      { valor: 'id', nome: 'ID (menor para o maior)' },
      { valor: 'recentes', nome: 'Mais recentes' }, { valor: 'nome', nome: 'Nome' },
    ]),
  ]);
  const lista = elemento('div', { className: 'lista-produtos-admin' });
  const selecionados = new Set();
  const publicarSelecionados = botao('Publicar selecionados', () => lote('publicar'));
  const arquivarSelecionados = botao('Arquivar selecionados', () => lote('arquivar'));
  const limparSelecao = botao('Limpar seleção', () => {
    selecionados.clear();
    lista.querySelectorAll('input[type="checkbox"]').forEach((entrada) => {
      entrada.checked = false;
      entrada.dispatchEvent(new Event('change'));
    });
    atualizarAcoesSelecionados();
  });
  const contadorSelecao = elemento('span', { className: 'contador-selecao-admin', role: 'status' });
  function atualizarAcoesSelecionados() {
    publicarSelecionados.hidden = selecionados.size === 0;
    arquivarSelecionados.hidden = selecionados.size === 0;
    limparSelecao.hidden = selecionados.size === 0;
    contadorSelecao.hidden = selecionados.size === 0;
    contadorSelecao.textContent = `${selecionados.size} ${selecionados.size === 1 ? 'produto selecionado' : 'produtos selecionados'}`;
  }
  atualizarAcoesSelecionados();
  let consultaAtual = 0;
  async function carregar() {
    const consulta = ++consultaAtual;
    const parametrosBusca = new URLSearchParams(new FormData(filtros));
    const idPesquisado = identificarId(parametrosBusca.get('busca'));
    // Filtra o ID exato também no navegador, inclusive com um servidor ainda não reiniciado.
    if (idPesquisado !== null) parametrosBusca.delete('busca');
    const [produtos, midias] = await Promise.all([
      requisitar(`/api/admin/produtos?${parametrosBusca}`),
      requisitar('/api/admin/midias'),
    ]);
    if (consulta !== consultaAtual) return;
    const dados = filtrarIdExato(produtos, idPesquisado);
    if (parametrosBusca.get('ordem') === 'id') dados.sort((a, b) => a.id - b.id);
    const imagensPorId = new Map(midias.map((item) => [item.id, item]));
    selecionados.clear();
    atualizarAcoesSelecionados();
    lista.replaceChildren();
    if (!dados.length) { lista.append(elemento('p', {}, 'Nenhum produto encontrado.')); return; }
    lista.append(...dados.map((item) => {
      let abrindo = false;
      async function editarProduto() {
        if (abrindo) return;
        abrindo = true;
        try { await abrirEditor(item.id, carregar); }
        catch (erro) { avisar(erro.message, true); }
        finally { abrindo = false; }
      }
      const checkbox = elemento('input', { type: 'checkbox', 'aria-label': `Selecionar ${item.nome}` });
      const textoSelecao = elemento('span', {}, 'Selecionar');
      const selecao = elemento('label', { className: 'selecionar-produto-admin' }, [checkbox, textoSelecao]);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selecionados.add(item.id);
        else selecionados.delete(item.id);
        textoSelecao.textContent = checkbox.checked ? 'Selecionado' : 'Selecionar';
        checkbox.closest('.cartao-produto-admin')?.classList.toggle('produto-selecionado', checkbox.checked);
        atualizarAcoesSelecionados();
      });
      const acoes = elemento('div', { className: 'acoes-linha' }, [
        botao('Editar', () => abrirEditor(item.id, carregar)),
        elemento('a', { href: `/paginas/produtos.html?previa=${item.id}`, target: '_blank', rel: 'noopener', className: 'botao-secundario' }, 'Prévia'),
        botao('Duplicar', async () => {
          const copia = await requisitar(`/api/admin/produtos/${item.id}/duplicar`, { method: 'POST', body: {} });
          await carregar();
          await abrirEditor(copia.id, carregar);
        }),
        botao(item.estado === 'arquivado' ? 'Restaurar' : 'Arquivar', async () => {
          await requisitar(`/api/admin/produtos/${item.id}/estado`, {
            method: 'POST', body: { acao: item.estado === 'arquivado' ? 'restaurar' : 'arquivar' },
          });
          await carregar();
        }),
      ]);
      if (item.estado !== 'arquivado') acoes.append(botao('Publicar rascunho', async () => {
        if (!confirm(`Publicar a versão atual de “${item.nome}”?`)) return;
        await requisitar(`/api/admin/produtos/${item.id}/estado`, { method: 'POST', body: { acao: 'publicar' } });
        avisar('Produto publicado.');
        await carregar();
      }));
      acoes.append(botao('Excluir produto', async () => {
        if (!confirm(`Excluir definitivamente “${item.nome}”? O produto e seus preços serão removidos do site e do painel. Esta ação não pode ser desfeita. As imagens continuarão na biblioteca.`)) return;
        await requisitar(`/api/admin/produtos/${item.id}`, { method: 'DELETE' });
        try {
          criarRascunhoProduto(window.localStorage, usuarioAtual()?.id, item.id).limpar();
        } catch {}
        avisar('Produto excluído.');
        await carregar();
      }, 'botao-secundario botao-excluir-produto'));
      const icones = elemento('div', { className: 'icones-menu-produto' });
      for (const acao of [...acoes.querySelectorAll('button')]) {
        if (['Arquivar', 'Restaurar', 'Excluir produto'].includes(acao.textContent)) {
          const rotulo = acao.textContent;
          icones.append(usarIcone(acao, rotulo === 'Excluir produto' ? 'excluir'
            : rotulo === 'Restaurar' ? 'restaurar' : 'arquivar', rotulo));
        }
      }
      acoes.append(icones);
      const midia = imagensPorId.get(item.imagem_id) || item.imagem;
      const imagem = midia ? elemento('img', {
        className: 'miniatura-produto-admin', src: midia.miniatura_url || midia.miniatura || midia.url,
        alt: '', width: 72, height: 72, loading: 'lazy',
      }) : elemento('span', { className: 'miniatura-produto-admin sem-foto-admin', 'aria-label': 'Sem foto' }, '—');
      const identificacao = elemento('div', { className: 'identificacao-produto-admin' }, [
        imagem, elemento('div', { className: 'texto-produto-admin' }, [
          elemento('button', {
            type: 'button', className: 'nome-produto-editar',
            'aria-label': `Editar ${item.nome}, ID ${item.id}`, onclick: editarProduto,
          }, item.nome),
          elemento('span', { className: 'id-produto-admin' }, `ID #${item.id}`),
          elemento('span', { className: `situacao-produto-admin situacao-${item.estado}` }, item.estado),
          item.pendente ? elemento('small', {}, 'Alterações ainda não publicadas') : null,
        ]),
      ]);
      const pendencias = item.pendencias.length ? elemento('p', { className: 'pendencias-produto-admin' },
        `Falta completar: ${item.pendencias.join(' · ')}`) : null;
      const cartao = elemento('article', { className: 'cartao-produto-admin' }, [
        elemento('div', { className: 'cabecalho-cartao-admin' }, [selecao, menuAcoesProduto(item.nome, acoes)]),
        identificacao, controleEstoque(item), pendencias,
      ]);
      cartao.addEventListener('click', (evento) => {
        if (evento.target.closest('button, a, input, label, select, textarea, form, [popover]')) return;
        editarProduto();
      });
      return cartao;
    }));
  }
  async function lote(acao) {
    if (!selecionados.size) throw new Error('Selecione ao menos um produto.');
    if (!confirm(`${acao === 'publicar' ? 'Publicar' : 'Arquivar'} ${selecionados.size} produtos selecionados?`)) return;
    await requisitar('/api/admin/lote', { method: 'POST', body: { ids: [...selecionados], acao } });
    avisar('Ação em lote concluída.');
    await carregar();
  }
  container.append(elemento('div', { className: 'acoes-linha' }, [
    botao('Cadastrar produto', () => abrirEditor(null, carregar), 'botao'),
    publicarSelecionados,
    arquivarSelecionados,
    limparSelecao,
    contadorSelecao,
    botao('Exportar catálogo', exportarCatalogo),
  ]), filtros, lista);
  let esperaPesquisa;
  async function aplicarFiltros() {
    clearTimeout(esperaPesquisa);
    try { await carregar(); } catch (erro) { avisar(erro.message, true); }
  }
  filtros.elements.busca.addEventListener('input', () => {
    clearTimeout(esperaPesquisa);
    // Impede que uma consulta anterior sobrescreva o texto que acabou de ser digitado.
    consultaAtual += 1;
    esperaPesquisa = setTimeout(aplicarFiltros, 250);
  });
  filtros.querySelectorAll('select').forEach((entrada) => entrada.addEventListener('change', aplicarFiltros));
  filtros.addEventListener('submit', (evento) => {
    evento.preventDefault();
    aplicarFiltros();
  });
  await carregar();
  if (parametros.has('novo')) await abrirEditor(null, carregar);
  if (parametros.has('editar')) await abrirEditor(Number(parametros.get('editar')), carregar);
}
