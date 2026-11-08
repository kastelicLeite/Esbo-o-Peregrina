const bcrypt = require('bcryptjs');
const { banco, transacao } = require('../dados/banco.cjs');
const { exigir, texto } = require('../http/validacao.cjs');
const acesso = require('./servico.cjs');
const { validarNome } = require('./nomes.cjs');

function confirmarSenha(dados) {
  const senha = acesso.validarSenha(dados?.senha);
  exigir(dados.confirmacao === senha, 'As senhas não coincidem.');
  return senha;
}

async function cadastrar(dados) {
  const nome = texto(dados?.nome, 100, 'o nome');
  const email = acesso.emailNormalizado(dados?.email);
  const hash = await bcrypt.hash(confirmarSenha(dados), 12);
  transacao(() => {
    if (banco.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email)) return;
    banco.prepare(`INSERT INTO usuarios (nome, email, senha_hash, perfil)
      VALUES (?, ?, ?, 'cliente')`).run(validarNome(nome), email, hash);
  });
}

function alterarNome(usuario, nome) {
  return transacao(() => {
    banco.prepare('UPDATE usuarios SET nome = ? WHERE id = ? AND ativo = 1')
      .run(validarNome(nome, usuario.id), usuario.id);
    return acesso.publico(banco.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuario.id));
  });
}

async function alterarSenha(usuario, dados) {
  const atual = dados?.senha_atual;
  exigir(typeof atual === 'string' && Buffer.byteLength(atual) <= 72, 'Confira a senha atual.', 400);
  exigir(await bcrypt.compare(atual, usuario.senha_hash), 'Confira a senha atual.', 400);
  const hash = await bcrypt.hash(confirmarSenha(dados), 12);
  transacao(() => {
    const resultado = banco.prepare(`UPDATE usuarios SET senha_hash = ?
      WHERE id = ? AND senha_hash = ? AND ativo = 1`)
      .run(hash, usuario.id, usuario.senha_hash);
    exigir(resultado.changes === 1, 'Sua conta mudou. Entre novamente.', 401);
    banco.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(usuario.id);
    banco.prepare('DELETE FROM recuperacoes WHERE usuario_id = ?').run(usuario.id);
    banco.prepare('DELETE FROM recuperacoes_codigos WHERE usuario_id = ?').run(usuario.id);
  });
}

module.exports = { confirmarSenha, cadastrar, alterarNome, alterarSenha };
