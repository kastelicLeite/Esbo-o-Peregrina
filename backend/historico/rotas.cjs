const express = require('express');
const { rateLimit } = require('express-rate-limit');
const servico = require('./servico.cjs');
const router = express.Router();
const limite = rateLimit({ windowMs: 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { erro: 'Aguarde um minuto para atualizar o histórico.' } });
router.get('/', (pedido, resposta) => resposta.json(servico.ler(pedido.usuario.id)));
router.post('/', limite, (pedido, resposta) => resposta.json(servico.registrar(pedido.usuario.id, pedido.body)));
router.delete('/', (pedido, resposta) => {
  servico.limpar(pedido.usuario.id, pedido.body?.tipo);
  resposta.status(204).end();
});
router.put('/preferencia', (pedido, resposta) => {
  servico.configurar(pedido.usuario.id, pedido.body);
  resposta.status(204).end();
});
module.exports = router;
