const { banco, transacao, registrar } = require('../dados/banco.cjs');
const { exigir } = require('../http/validacao.cjs');
const { validarEstoque } = require('./validacao.cjs');

function atualizarEstoque(id, dados, usuario) {
  exigir(dados && Object.hasOwn(dados, 'estoque') && Object.hasOwn(dados, 'estoque_anterior'),
    'Informe o estoque atual e o novo valor.');
  const estoque = validarEstoque(dados.estoque);
  const anterior = validarEstoque(dados.estoque_anterior);
  return transacao(() => {
    const produto = banco.prepare('SELECT estoque, atualizado_em, publicado_json FROM produtos WHERE id = ?').get(id);
    exigir(produto, 'Produto não encontrado.', 404);
    exigir(produto.estoque === anterior,
      'O estoque mudou em outra sessão. Atualize o catálogo para conferir o valor antes de salvar.', 409);
    if (estoque === anterior) return { estoque, atualizado_em: produto.atualizado_em };
    const instanteAnterior = Date.parse(produto.atualizado_em);
    const proximoInstante = Number.isFinite(instanteAnterior) ? instanteAnterior + 1 : 0;
    const atualizado = new Date(Math.max(Date.now(), proximoInstante)).toISOString();
    const publicado = produto.publicado_json ? JSON.parse(produto.publicado_json) : null;
    if (publicado && publicado.atualizado_em === produto.atualizado_em) publicado.atualizado_em = atualizado;
    banco.prepare('UPDATE produtos SET estoque = ?, atualizado_em = ?, publicado_json = ? WHERE id = ?')
      .run(estoque, atualizado, publicado ? JSON.stringify(publicado) : null, id);
    registrar(usuario, `Alterou estoque de ${anterior ?? 'sem controle'} para ${estoque ?? 'sem controle'}`, 'produto', id);
    return { estoque, atualizado_em: atualizado };
  });
}

module.exports = { atualizarEstoque };
