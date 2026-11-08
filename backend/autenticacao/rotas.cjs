const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { banco, registrar } = require('../dados/banco.cjs');
const servico = require('./servico.cjs');
const restricoes = require('./restricoes.cjs');
const { exigirGestao } = require('./permissoes.cjs');

const router = express.Router();
const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
});

router.post('/entrar', limite, async (pedido, resposta) => {
  const acesso = await servico.entrar(pedido.body?.email, pedido.body?.senha);
  const anterior = servico.sessao(pedido);
  if (anterior) banco.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(anterior.token_hash);
  resposta.set('Set-Cookie', servico.cookie(acesso.token, pedido.secure));
  resposta.json({ usuario: acesso.usuario, csrf: acesso.csrf });
});

router.post('/recuperar', limite, async (pedido, resposta) => {
  await servico.recuperar(pedido.body?.token, pedido.body?.senha);
  resposta.json({ sucesso: true });
});

router.use(servico.autenticar, servico.equipe, servico.protegerEscrita);
router.get('/sessao', (pedido, resposta) => {
  resposta.json({ usuario: servico.publico(pedido.usuario), csrf: pedido.usuario.csrf });
});

router.post('/sair', (pedido, resposta) => {
  banco.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(pedido.usuario.token_hash);
  resposta.set('Set-Cookie', servico.cookie('', pedido.secure, true)).status(204).end();
});

router.use(require('./acesso-painel.cjs').proteger);

router.get('/usuarios', servico.administrador, (pedido, resposta) => {
  resposta.json(banco.prepare("SELECT * FROM usuarios WHERE perfil IN ('administrador', 'editor', 'criador') ORDER BY nome").all().map(servico.publico));
});

router.get('/contas', servico.administrador, (pedido, resposta) => {
  resposta.json(restricoes.listar());
});

router.put('/contas/:id/restricao', servico.administrador, (pedido, resposta) => {
  restricoes.alterar(Number(pedido.params.id), pedido.body, pedido.usuario);
  resposta.status(204).end();
});

router.put('/contas/:id/perfil', servico.administrador, (pedido, resposta) => {
  resposta.json(servico.alterarPerfil(Number(pedido.params.id), pedido.body, pedido.usuario));
});

router.post('/usuarios', servico.administrador, async (pedido, resposta) => {
  resposta.status(201).json(await servico.criarUsuario(pedido.body, pedido.usuario));
});

router.put('/usuarios/:id', servico.administrador, (pedido, resposta) => {
  resposta.json(servico.alterarUsuario(Number(pedido.params.id), pedido.body, pedido.usuario));
});

router.delete('/usuarios/:id/sessoes', servico.administrador, (pedido, resposta) => {
  exigirGestao(servico.exigirContaEquipe(Number(pedido.params.id)), pedido.usuario);
  banco.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(Number(pedido.params.id));
  registrar(pedido.usuario, 'Encerrou sessões', 'equipe', pedido.params.id);
  resposta.status(204).end();
});

router.post('/usuarios/:id/recuperacao', servico.administrador, (pedido, resposta) => {
  resposta.json({ token: servico.gerarRecuperacao(Number(pedido.params.id), pedido.usuario) });
});

module.exports = router;
