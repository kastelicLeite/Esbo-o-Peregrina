const { createHash } = require('node:crypto');
const { banco, transacao } = require('../dados/banco.cjs');
const { exigir, texto } = require('../http/validacao.cjs');
const { listarPublicos } = require('../produtos/servico.cjs');
const { validarOrcamento } = require('../produtos/orcamento.cjs');

const limites = { pesquisa: 50, visualizacao: 100, orcamento: 30 };
const prazo = 90 * 86400000;
const ativo = id => banco.prepare('SELECT ativo FROM preferencias_historico WHERE usuario_id = ?').get(id)?.ativo !== 0;

function resumirOrcamento(entrada, catalogo) {
  const resumo = validarOrcamento(entrada.itens, catalogo);
  if (resumo.pode_enviar || entrada.origem !== 'produto' || entrada.itens?.length !== 1) return resumo;
  const item = entrada.itens[0];
  const produto = catalogo.find(produto => produto.id === item.produto_id);
  exigir(produto && Number.isSafeInteger(item.quantidade) && item.quantidade > 0 && item.quantidade <= 10000000,
    'Confira o produto e a quantidade.');
  if (produto.tiragens.includes(item.quantidade)) return resumo;
  const variacao = produto.variacoes.find(variacao => item.opcoes && Object.keys(variacao.opcoes).length === Object.keys(item.opcoes).length
    && Object.keys(variacao.opcoes).every(chave => variacao.opcoes[chave] === item.opcoes[chave]));
  if (!variacao) return resumo;
  const referencia = validarOrcamento([{ ...item, quantidade: variacao.quantidade }], catalogo);
  if (!referencia.pode_enviar) return resumo;
  return { ...referencia, com_preco: 0, subtotal_centavos: 0, sob_orcamento: 1,
    itens: [{ ...referencia.itens[0], quantidade: item.quantidade, total_centavos: null, unitario_centavos: null, aproximado: false }] };
}

function ler(id) {
  banco.prepare('DELETE FROM historico_clientes WHERE usuario_id = ? AND criado_em < ?').run(id, Date.now() - prazo);
  const eventos = banco.prepare('SELECT id, tipo, dados, criado_em FROM historico_clientes WHERE usuario_id = ? ORDER BY criado_em DESC, id DESC')
    .all(id).map(item => ({ ...item, dados: JSON.parse(item.dados) }));
  return { ativo: ativo(id), eventos, origem: 'conta' };
}

function registrar(id, entrada) {
  exigir(entrada && Object.hasOwn(limites, entrada.tipo), 'Tipo de atividade inválido.');
  if (!ativo(id)) return { salvo: false };
  const { tipo } = entrada;
  let dados;
  let chave;
  if (tipo === 'pesquisa') {
    const termo = texto(entrada.termo, 180, 'a pesquisa').replace(/\s+/g, ' ');
    exigir(termo.length >= 2, 'Digite ao menos dois caracteres.');
    dados = { termo };
    chave = termo.normalize('NFKC').toLocaleLowerCase('pt-BR');
  } else {
    const catalogo = listarPublicos();
    if (tipo === 'visualizacao') {
      const produto = catalogo.find(item => item.id === entrada.produto_id);
      exigir(produto, 'Produto indisponível.', 404);
      dados = { produto_id: produto.id, nome: produto.nome, slug: produto.slug, categoria_id: produto.categoria_id };
      chave = String(produto.id);
    } else {
      const resumo = resumirOrcamento(entrada, catalogo);
      exigir(resumo.pode_enviar, 'Confira os itens antes de guardar o orçamento.');
      dados = { estado: 'preparado', subtotal_centavos: resumo.subtotal_centavos, sob_orcamento: resumo.sob_orcamento,
        itens: resumo.itens.map(item => ({ produto_id: item.produto_id, nome: item.nome, slug: item.slug,
          categoria_id: catalogo.find(produto => produto.id === item.produto_id).categoria_id,
          quantidade: item.quantidade, opcoes: item.opcoes, especificacoes: item.especificacoes,
          total_centavos: item.total_centavos, aproximado: item.aproximado })) };
      chave = JSON.stringify(dados);
    }
  }
  const assinatura = createHash('sha256').update(chave).digest('hex');
  transacao(() => {
    banco.prepare(`INSERT INTO historico_clientes (usuario_id, tipo, assinatura, dados, criado_em) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(usuario_id, tipo, assinatura) DO UPDATE SET dados = excluded.dados, criado_em = excluded.criado_em`)
      .run(id, tipo, assinatura, JSON.stringify(dados), Date.now());
    banco.prepare(`DELETE FROM historico_clientes WHERE usuario_id = ? AND tipo = ? AND id NOT IN
      (SELECT id FROM historico_clientes WHERE usuario_id = ? AND tipo = ? ORDER BY criado_em DESC, id DESC LIMIT ?)`)
      .run(id, tipo, id, tipo, limites[tipo]);
    banco.prepare('DELETE FROM historico_clientes WHERE usuario_id = ? AND criado_em < ?').run(id, Date.now() - prazo);
  });
  return { salvo: true };
}

function limpar(id, tipo) {
  exigir(tipo === undefined || Object.hasOwn(limites, tipo), 'Tipo de histórico inválido.');
  if (tipo) banco.prepare('DELETE FROM historico_clientes WHERE usuario_id = ? AND tipo = ?').run(id, tipo);
  else banco.prepare('DELETE FROM historico_clientes WHERE usuario_id = ?').run(id);
}

function configurar(id, entrada) {
  exigir(typeof entrada?.ativo === 'boolean', 'Confira a preferência do histórico.');
  banco.prepare(`INSERT INTO preferencias_historico (usuario_id, ativo) VALUES (?, ?)
    ON CONFLICT(usuario_id) DO UPDATE SET ativo = excluded.ativo`).run(id, entrada.ativo ? 1 : 0);
}

module.exports = { ler, registrar, limpar, configurar };
