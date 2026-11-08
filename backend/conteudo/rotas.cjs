const express = require('express');
const { administrador } = require('../autenticacao/servico.cjs');
const { banco } = require('../dados/banco.cjs');
const servico = require('./servico.cjs');

const router = express.Router();
router.get('/conteudo', (pedido, resposta) => resposta.json(servico.conteudo(true)));
router.put('/conteudo', (pedido, resposta) => resposta.json(servico.salvarConteudo(pedido.body, pedido.usuario)));
router.post('/conteudo/publicar', (pedido, resposta) => {
  servico.publicarConteudo(pedido.usuario);
  resposta.json({ sucesso: true });
});
router.get('/previa-site', (pedido, resposta) => resposta.json(servico.site(true)));
router.get('/configuracoes', administrador, (pedido, resposta) => resposta.json(servico.configuracoes()));
router.put('/configuracoes', administrador, (pedido, resposta) => resposta.json(servico.salvarConfiguracoes(pedido.body, pedido.usuario)));
router.get('/historico', administrador, (pedido, resposta) => {
  resposta.json(banco.prepare('SELECT * FROM historico ORDER BY id DESC LIMIT 300').all());
});

module.exports = router;
