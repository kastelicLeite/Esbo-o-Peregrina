const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { banco } = require('../dados/banco.cjs');
const acesso = require('./servico.cjs');
const clientes = require('./clientes.cjs');
const email = require('./email.cjs');
const restricoes = require('./restricoes.cjs');
const codigos = require('./recuperacao-codigo.cjs');

const router = express.Router();
const limitar = (total) => rateLimit({
  windowMs: 15 * 60 * 1000, limit: total, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
});

router.post('/cadastro', limitar(5), async (pedido, resposta) => {
  await clientes.cadastrar(pedido.body);
  resposta.status(201).json({ mensagem: 'Você já pode tentar entrar. Se não conseguir, use a recuperação de senha.' });
});

router.post('/entrar', limitar(10), async (pedido, resposta) => {
  const resultado = await acesso.entrar(pedido.body?.email, pedido.body?.senha);
  const anterior = acesso.sessao(pedido);
  if (anterior) banco.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(anterior.token_hash);
  resposta.set('Set-Cookie', acesso.cookie(resultado.token, pedido.secure));
  resposta.json({ usuario: resultado.usuario, csrf: resultado.csrf });
});

router.post('/solicitar-recuperacao', limitar(5), async (pedido, resposta) => {
  const endereco = acesso.emailNormalizado(pedido.body?.email);
  const config = email.configuracao();
  const usuario = banco.prepare("SELECT id FROM usuarios WHERE email = ? AND perfil = 'cliente' AND ativo = 1").get(endereco);
  if (usuario && !restricoes.bloqueada(usuario.id)) {
    const token = acesso.gerarRecuperacao(usuario.id, null, 'cliente');
    try {
      await email.enviarRecuperacao(endereco, token, config);
    } catch {
      banco.prepare('DELETE FROM recuperacoes WHERE token_hash = ?').run(acesso.resumir(token));
      console.error('Não foi possível entregar um e-mail de recuperação. Verifique o provedor.');
    }
  }
  resposta.status(202).json({ mensagem: 'Se houver uma conta de cliente com esse e-mail, tentaremos enviar um link de recuperação. Confira também o spam. Se não chegar, tente mais tarde ou fale com a equipe.' });
});

router.post('/redefinir-senha', limitar(10), async (pedido, resposta) => {
  clientes.confirmarSenha(pedido.body);
  await acesso.recuperar(pedido.body?.token, pedido.body.senha, 'cliente');
  resposta.json({ mensagem: 'Senha atualizada. Entre novamente com a nova senha.' });
});

router.post('/solicitar-codigo', limitar(5), async (pedido, resposta) => {
  resposta.status(202).json(await codigos.solicitar(pedido.body));
});
router.post('/conferir-email-recuperacao', limitar(10), (pedido, resposta) => {
  resposta.json(codigos.conferirEmail(pedido.body));
});
router.post('/validar-codigo', limitar(20), (pedido, resposta) => {
  resposta.json(codigos.validar(pedido.body));
});
router.post('/redefinir-com-codigo', limitar(10), async (pedido, resposta) => {
  resposta.json(await codigos.redefinir(pedido.body));
});

router.use(acesso.autenticar, acesso.protegerEscrita);
router.use('/historico', require('../historico/rotas.cjs'));
router.get('/sessao', (pedido, resposta) => {
  resposta.json({ usuario: acesso.publico(pedido.usuario), csrf: pedido.usuario.csrf });
});
router.patch('/nome', (pedido, resposta) => {
  resposta.json({ usuario: clientes.alterarNome(pedido.usuario, pedido.body?.nome) });
});
router.put('/senha', limitar(10), async (pedido, resposta) => {
  await clientes.alterarSenha(pedido.usuario, pedido.body);
  resposta.set('Set-Cookie', acesso.cookie('', pedido.secure, true));
  resposta.json({ mensagem: 'Senha atualizada. Todas as sessões foram encerradas. Entre novamente.' });
});
router.post('/sair', (pedido, resposta) => {
  banco.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(pedido.usuario.token_hash);
  resposta.set('Set-Cookie', acesso.cookie('', pedido.secure, true)).status(204).end();
});

module.exports = router;
