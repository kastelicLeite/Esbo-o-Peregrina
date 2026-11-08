const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const { banco, transacao, registrar } = require('../dados/banco.cjs');
const { exigir } = require('../http/validacao.cjs');
const acesso = require('./servico.cjs');

function configurada() {
  return banco.prepare('SELECT senha_hash FROM senha_painel WHERE id = 1').get();
}

function liberado(usuario) {
  return Boolean(usuario && banco.prepare('SELECT 1 FROM acessos_painel WHERE token_hash = ? AND expira_em > ?')
    .get(usuario.token_hash, Date.now()));
}

function proteger(pedido, resposta, proximo) {
  if (!liberado(pedido.usuario)) {
    return resposta.status(403).json({ erro: 'Informe a senha do painel para continuar.', codigo: 'SENHA_PAINEL' });
  }
  proximo();
}

function tabelasLiberadas(usuario) {
  return Boolean(liberado(usuario) && banco.prepare('SELECT 1 FROM acessos_tabelas WHERE token_hash = ? AND expira_em > ?')
    .get(usuario.token_hash, Date.now()));
}

function protegerTabelas(pedido, resposta, proximo) {
  if (!tabelasLiberadas(pedido.usuario)) {
    return resposta.status(403).json({ erro: 'Confirme a senha para consultar as tabelas.', codigo: 'SENHA_TABELAS' });
  }
  proximo();
}

function permitirConfiguracao(usuario) {
  return usuario.perfil === 'criador';
}

function liberar(usuario) {
  banco.prepare('DELETE FROM acessos_painel WHERE expira_em <= ?').run(Date.now());
  banco.prepare('INSERT OR REPLACE INTO acessos_painel VALUES (?, ?)')
    .run(usuario.token_hash, Date.now() + 2 * 60 * 60 * 1000);
}

const rotas = express.Router();
const limite = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' } });
rotas.use(acesso.autenticar, acesso.equipe, acesso.protegerEscrita);
rotas.get('/', (pedido, resposta) => {
  resposta.json({ configurada: Boolean(configurada()), liberado: liberado(pedido.usuario),
    pode_configurar: permitirConfiguracao(pedido.usuario), csrf: pedido.usuario.csrf });
});

rotas.post('/', limite, async (pedido, resposta) => {
  const tabelas = pedido.body?.destino === 'banco';
  if (tabelas) acesso.administrador(pedido, resposta, () => {});
  const registro = configurada();
  exigir(registro, 'A senha compartilhada ainda precisa ser definida pelo Criador.', 409);
  const senha = pedido.body?.senha;
  exigir(typeof senha === 'string' && Buffer.byteLength(senha) <= 72, 'Senha do painel incorreta.', 401);
  const correta = await bcrypt.compare(senha, registro.senha_hash);
  exigir(correta, 'Senha do painel incorreta.', 401);
  const atual = acesso.sessao(pedido);
  exigir(atual && configurada()?.senha_hash === registro.senha_hash, 'Sua sessão mudou. Entre novamente.', 401);
  liberar(atual);
  if (tabelas) {
    banco.prepare('DELETE FROM acessos_tabelas WHERE expira_em <= ?').run(Date.now());
    banco.prepare('INSERT OR REPLACE INTO acessos_tabelas VALUES (?, ?)')
      .run(atual.token_hash, Date.now() + 15 * 60 * 1000);
  }
  resposta.json({ sucesso: true });
});

rotas.put('/', limite, async (pedido, resposta) => {
  exigir(permitirConfiguracao(pedido.usuario), 'Somente o Criador pode definir a senha do painel.', 403);
  const anterior = configurada();
  if (anterior) {
    exigir(liberado(pedido.usuario), 'Desbloqueie o painel antes de alterar a senha.', 403);
    exigir(typeof pedido.body?.senha_atual === 'string' && Buffer.byteLength(pedido.body.senha_atual) <= 72
      && await bcrypt.compare(pedido.body.senha_atual, anterior.senha_hash), 'Senha atual do painel incorreta.', 401);
  }
  const senha = acesso.validarSenha(pedido.body?.senha);
  exigir(senha === pedido.body?.confirmacao, 'As senhas não coincidem.');
  const hash = await bcrypt.hash(senha, 12);
  transacao(() => {
    const atual = acesso.sessao(pedido);
    exigir(atual && permitirConfiguracao(atual), 'Sua sessão mudou. Entre novamente.', 401);
    exigir(configurada()?.senha_hash === anterior?.senha_hash, 'A senha foi alterada por outra pessoa. Recarregue a página.', 409);
    banco.prepare('INSERT OR REPLACE INTO senha_painel VALUES (1, ?)').run(hash);
    banco.prepare('DELETE FROM acessos_painel').run();
    banco.prepare('DELETE FROM acessos_tabelas').run();
    liberar(atual);
    registrar(atual, anterior ? 'Alterou senha compartilhada do painel' : 'Definiu senha compartilhada do painel', 'acesso', 'painel');
  });
  resposta.json({ sucesso: true });
});

module.exports = { rotas, proteger, liberado, protegerTabelas, tabelasLiberadas };
