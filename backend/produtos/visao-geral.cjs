const express = require('express');
const { banco } = require('../dados/banco.cjs');
const produtos = require('./servico.cjs');
const backups = require('../manutencao/agendamento-backup.cjs');
const backupExterno = require('../manutencao/backup-externo.cjs');

const rotas = express.Router();

rotas.get('/visao-geral', (pedido, resposta) => {
  const todos = banco.prepare('SELECT id FROM produtos').all().map(({ id }) => produtos.obterProduto(id));
  const atuais = todos.filter((item) => item.estado !== 'arquivado');
  const publicos = produtos.listarPublicos();
  const pendencias = atuais.map((item) => ({ id: item.id, nome: item.nome, estado: item.estado,
    itens: produtos.pendencias(item), alteracao: item.pendente }));
  const categorias = banco.prepare('SELECT id, nome, ativa FROM categorias ORDER BY posicao, nome').all()
    .map((categoria) => ({ ...categoria, total: todos.filter((item) => item.categoria_id === categoria.id).length,
      visiveis: publicos.filter((item) => item.categoria_id === categoria.id).length }));
  const landing = banco.prepare('SELECT rascunho, publicado FROM conteudos WHERE id = 1').get();
  const dados = {
    atualizado_em: new Date().toISOString(),
    publicados: todos.filter((item) => item.estado === 'publicado').length,
    rascunhos: todos.filter((item) => item.estado === 'rascunho').length,
    arquivados: todos.filter((item) => item.estado === 'arquivado').length,
    resumo: { total: todos.length, visiveis: publicos.length,
      sob_orcamento: publicos.filter((item) => !item.menor_preco).length,
      alteracoes: pendencias.filter((item) => item.alteracao).length,
      prontos: pendencias.filter((item) => item.estado === 'rascunho' && !item.itens.length).length },
    estoque: { zerados: atuais.filter((item) => item.estoque === 0).map(({ id, nome, estado }) => ({ id, nome, estado })),
      sem_controle: atuais.filter((item) => item.estoque === null).length,
      positivos: atuais.filter((item) => item.estoque > 0).length },
    recursos: { imagens: banco.prepare('SELECT COUNT(*) total FROM midias').get().total,
      categorias_ativas: categorias.filter((item) => item.ativa).length,
      landing_pendente: Boolean(landing && landing.rascunho !== landing.publicado) },
    categorias,
    pendencias: pendencias.filter((item) => item.itens.length || item.alteracao)
      .sort((a, b) => Number(b.alteracao) - Number(a.alteracao) || a.nome.localeCompare(b.nome, 'pt-BR')),
    recentes: banco.prepare(`SELECT autor, acao, entidade, registro, criado_em FROM historico
      ${pedido.usuario.perfil === 'editor' ? "WHERE entidade IN ('produto', 'categoria', 'midia', 'conteudo', 'catalogo')" : ''}
      ORDER BY id DESC LIMIT 10`).all(),
  };
  if (['administrador', 'criador'].includes(pedido.usuario.perfil)) {
    dados.contas = banco.prepare(`SELECT COUNT(*) total,
      SUM(CASE WHEN perfil = 'cliente' THEN 1 ELSE 0 END) clientes,
      SUM(CASE WHEN perfil != 'cliente' THEN 1 ELSE 0 END) equipe,
      SUM(CASE WHEN ativo = 0 THEN 1 ELSE 0 END) desativadas FROM usuarios`).get();
    dados.contas.bloqueadas = banco.prepare("SELECT COUNT(*) total FROM restricoes_contas WHERE tipo = 'banida' OR ate > ?").get(Date.now()).total;
  }
  if (pedido.usuario.perfil === 'criador') {
    try {
      const config = backups.configuracao();
      dados.backup = { ativo: config.ativo, intervalo: config.intervalo, ultimo: config.ultimo, erro: Boolean(config.erro) };
      const copias = backups.listar();
      dados.backup.externo = { ...backupExterno.disponibilidade(),
        ultimo: copias.find(item => item.externo.status === 'enviado')?.externo.em || null,
        falhas: copias.filter(item => item.externo.status === 'falha').length };
    } catch { dados.backup = { erro: true }; }
  }
  resposta.json(dados);
});

module.exports = rotas;
