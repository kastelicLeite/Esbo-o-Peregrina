import { requisitar } from './api.js';
import { elemento, titulo, tabela, formatarData, botao } from './interface.js';

const link = (texto, href, classe = '') => elemento('a', { href, className: classe }, texto);

function secao(nome, descricao, conteudo) {
  return elemento('section', { className: 'resumo-secao' }, [elemento('h2', {}, nome),
    elemento('p', { className: 'resumo-ajuda' }, descricao), ...conteudo]);
}

function listaProdutos(itens, mensagem, descrever) {
  if (!itens.length) return elemento('p', {}, mensagem);
  return elemento('ul', { className: 'resumo-lista' }, itens.slice(0, 6).map((item) => elemento('li', {}, [
    link(item.nome, `#catalogo?editar=${item.id}`), elemento('small', {}, `ID ${item.id} · ${descrever(item)}`),
  ])));
}

export async function montar(container) {
  const dados = await requisitar('/api/admin/visao-geral');
  const pagina = elemento('div', { className: 'visao-geral' });
  pagina.append(elemento('div', { className: 'resumo-cabecalho' }, [
    titulo('Visão geral', 'O que precisa de atenção e os caminhos para continuar o trabalho.'),
    botao('Atualizar dados', () => montar(container)),
  ]), elemento('p', { className: 'resumo-ajuda', role: 'status' }, `Dados consultados em ${formatarData(dados.atualizado_em)}.`));
  const indicadores = elemento('div', { className: 'resumo-indicadores', 'aria-label': 'Resumo do catálogo' });
  const itens = [
    [dados.resumo.visiveis, 'Visíveis no site', `${dados.publicados} publicados no cadastro`, '/paginas/produtos.html'],
    [dados.rascunhos, 'Rascunhos', `${dados.resumo.prontos} prontos para publicar`, '#catalogo?estado=rascunho'],
    [dados.resumo.alteracoes, 'Alterações não publicadas', 'Revise antes de publicar', '#catalogo?revisao=alteracoes'],
    [dados.estoque.zerados.length, 'Sem estoque', 'Controle interno, sem arquivados', '#catalogo?estoque=zerado&estado=ativos'],
    [dados.resumo.total, 'Produtos cadastrados', `${dados.arquivados} arquivados`, '#catalogo'],
    [dados.resumo.sob_orcamento, 'Sob orçamento', 'Visíveis sem preço inicial', '/paginas/produtos.html?tipo=orcamento'],
  ];
  for (const [valor, rotulo, detalhe, href] of itens) indicadores.append(elemento('a', { href, className: 'resumo-indicador' }, [
    elemento('strong', {}, valor), elemento('span', {}, rotulo), elemento('small', {}, detalhe),
  ]));
  pagina.append(indicadores, elemento('div', { className: 'acoes-linha resumo-atalhos' }, [
    link('Cadastrar produto', '#catalogo?novo=1', 'botao'), link('Biblioteca de imagens', '#midias', 'botao-secundario'),
    link('Editar página inicial', '#conteudo', 'botao-secundario'), link('Manual do painel', '#manual', 'botao-secundario'),
  ]));
  const grade = elemento('div', { className: 'resumo-grade' });
  grade.append(secao('Para revisar agora', `${dados.pendencias.length} produtos incompletos ou com alterações pendentes.`, [
    listaProdutos(dados.pendencias, 'Nenhuma pendência encontrada.', (item) =>
      [...(item.alteracao ? ['Alterações não publicadas'] : []), ...item.itens].join(' · ')),
    elemento('div', { className: 'resumo-links' }, [link('Ver cadastros incompletos →', '#catalogo?revisao=pendencias'),
      link(`Revisar ${dados.resumo.prontos} rascunhos prontos →`, '#catalogo?revisao=prontos')]),
  ]), secao('Estoque interno', 'O carrinho não reserva produtos nem dá baixa automática.', [
    elemento('p', {}, `${dados.estoque.positivos} produtos com saldo positivo · ${dados.estoque.sem_controle} sem controle.`),
    listaProdutos(dados.estoque.zerados, 'Nenhum produto ativo com estoque zerado.', () => 'Sem estoque'),
    elemento('div', { className: 'resumo-links' }, [link('Conferir todos sem estoque →', '#catalogo?estoque=zerado&estado=ativos'),
      link('Ver produtos sem controle →', '#catalogo?estoque=sem-controle&estado=ativos')]),
  ]), secao('Categorias no catálogo', 'Contagem pública. Categorias desativadas ocultam seus produtos.', [
    elemento('ul', { className: 'resumo-lista' }, dados.categorias.map((item) => elemento('li', {}, [
      link(item.nome, `#catalogo?categoria=${item.id}`),
      elemento('small', {}, `${item.visiveis} visíveis de ${item.total} cadastrados · ${item.ativa ? 'Ativa' : 'Desativada'}`),
    ]))), link('Gerenciar categorias →', '#categorias'),
  ]), secao('Conteúdo e biblioteca', 'Confira o que ainda precisa ser publicado.', [
    elemento('p', {}, `${dados.recursos.imagens} imagens na biblioteca · ${dados.recursos.categorias_ativas} categorias ativas.`),
    elemento('p', { className: dados.recursos.landing_pendente ? 'resumo-atencao' : '' }, dados.recursos.landing_pendente
      ? 'Página inicial com alterações ainda não publicadas.' : 'Página inicial sem alterações pendentes de publicação.'),
    elemento('div', { className: 'resumo-links' }, [link('Revisar página inicial →', '#conteudo'), link('Organizar imagens →', '#midias')]),
  ]));
  if (dados.contas) grade.append(secao('Contas e acesso', 'Contas desativadas e bloqueadas podem se sobrepor.', [
    elemento('p', {}, `${dados.contas.total} contas · ${dados.contas.clientes || 0} clientes · ${dados.contas.equipe || 0} da equipe.`),
    elemento('p', {}, `${dados.contas.bloqueadas} bloqueadas · ${dados.contas.desativadas || 0} desativadas.`),
    elemento('div', { className: 'resumo-links' }, [link('Gerenciar contas →', '#contas'), link('Permissões da equipe →', '#equipe'),
      link('Atualizar contatos →', '#configuracoes')]),
  ]));
  if (dados.backup) grade.append(secao('Backup automático', 'O agendamento depende de o servidor permanecer ligado.', [
    elemento('p', { className: dados.backup.erro ? 'resumo-atencao' : '' }, dados.backup.erro
      ? 'O backup precisa de atenção. Confira Histórico e manutenção.'
      : `${dados.backup.ativo ? 'Ativo' : 'Pausado'} · intervalo de ${dados.backup.intervalo} horas.`),
    elemento('p', {}, dados.backup.ultimo ? `Último backup automático: ${formatarData(dados.backup.ultimo)}.` : 'Nenhuma execução automática registrada.'),
    ...(dados.backup.externo ? [elemento('p', {}, `Backup externo: ${dados.backup.externo.mensagem}`),
      elemento('p', {}, dados.backup.externo.ultimo ? `Último envio conferido: ${formatarData(dados.backup.externo.ultimo)}.` : 'Nenhuma cópia externa confirmada.'),
      ...(dados.backup.externo.falhas ? [elemento('p', { className: 'resumo-atencao' }, `${dados.backup.externo.falhas} cópias com falha no envio externo.`)] : [])] : []),
    link('Conferir backups e manutenção →', '#historico'),
  ]));
  pagina.append(grade, secao('Alterações recentes', 'Atividade administrativa, conforme suas permissões.', [
    dados.recentes.length ? tabela(['Quando', 'Pessoa', 'Ação', 'Registro'], dados.recentes.map((item) => elemento('tr', {}, [
      elemento('td', {}, formatarData(item.criado_em)), elemento('td', {}, item.autor), elemento('td', {}, item.acao),
      elemento('td', {}, item.entidade === 'produto' ? link(`Produto #${item.registro}`, `#catalogo?editar=${item.registro}`)
        : `${item.entidade} #${item.registro}`),
    ]))) : elemento('p', {}, 'Nenhuma alteração registrada.'),
  ]), elemento('p', { className: 'resumo-ajuda' }, 'Os indicadores mostram cadastros e atividade administrativa. O site não registra vendas nem confirma pedidos pelo WhatsApp.'));
  container.replaceChildren(pagina);
}
