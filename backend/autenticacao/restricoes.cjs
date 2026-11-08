const { banco, transacao, registrar } = require('../dados/banco.cjs');
const { exigir } = require('../http/validacao.cjs');
const { exigirGestao } = require('./permissoes.cjs');

function bloqueada(id) {
  return Boolean(banco.prepare(`SELECT 1 FROM restricoes_contas
    WHERE usuario_id = ? AND (tipo = 'banida' OR ate > ?)`).get(id, Date.now()));
}

function contarAdministradores() {
  return banco.prepare(`SELECT COUNT(*) AS total FROM usuarios u
    WHERE u.ativo = 1 AND u.perfil IN ('administrador', 'criador')
    AND NOT EXISTS (SELECT 1 FROM restricoes_contas r WHERE r.usuario_id = u.id
      AND (r.tipo = 'banida' OR r.ate > ?))`).get(Date.now()).total;
}

function listar() {
  return banco.prepare(`SELECT u.id, u.nome, u.email, u.perfil, u.ativo,
    CASE WHEN r.tipo = 'banida' THEN 'banida'
      WHEN r.ate > ? THEN 'suspensa' ELSE 'liberada' END AS situacao,
    CASE WHEN r.ate > ? THEN r.ate ELSE NULL END AS suspensa_ate
    FROM usuarios u LEFT JOIN restricoes_contas r ON r.usuario_id = u.id
    ORDER BY u.nome COLLATE NOCASE`).all(Date.now(), Date.now());
}

function alterar(id, dados, autor) {
  exigir(Number.isSafeInteger(id) && id > 0, 'Conta inválida.');
  exigir(['banir', 'suspender', 'liberar'].includes(dados?.acao), 'Escolha uma ação válida.');
  if (dados.acao === 'suspender') exigir([1, 7, 30].includes(dados.dias), 'Escolha 1, 7 ou 30 dias.');
  return transacao(() => {
    const usuario = banco.prepare('SELECT id, perfil, ativo FROM usuarios WHERE id = ?').get(id);
    exigir(usuario, 'Conta não encontrada.', 404);
    exigirGestao(usuario, autor);
    exigir(!(dados.acao === 'banir' && usuario.perfil === 'administrador' && autor.perfil !== 'criador'),
      'Somente um Criador pode banir administradores.', 403);
    if (dados.acao !== 'liberar') {
      exigir(id !== autor.id, 'Você não pode bloquear a própria conta.');
      exigir(!(usuario.ativo && ['administrador', 'criador'].includes(usuario.perfil) && !bloqueada(id)
        && contarAdministradores() <= 1), 'Mantenha ao menos um administrador ativo.');
      const ate = dados.acao === 'suspender' ? Date.now() + dados.dias * 86400000 : null;
      banco.prepare(`INSERT INTO restricoes_contas (usuario_id, tipo, ate) VALUES (?, ?, ?)
        ON CONFLICT(usuario_id) DO UPDATE SET tipo = excluded.tipo, ate = excluded.ate`)
        .run(id, dados.acao === 'banir' ? 'banida' : 'suspensa', ate);
    } else banco.prepare('DELETE FROM restricoes_contas WHERE usuario_id = ?').run(id);
    banco.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(id);
    banco.prepare('DELETE FROM recuperacoes WHERE usuario_id = ?').run(id);
    banco.prepare('DELETE FROM recuperacoes_codigos WHERE usuario_id = ?').run(id);
    const acao = dados.acao === 'banir' ? 'Baniu conta' : dados.acao === 'suspender'
      ? `Suspendeu conta por ${dados.dias} dias` : 'Removeu bloqueio da conta';
    registrar(autor, acao, 'contas', id);
  });
}

module.exports = { bloqueada, contarAdministradores, listar, alterar };
