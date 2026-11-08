const express = require('express');
const { rateLimit } = require('express-rate-limit');
const servico = require('./servico.cjs');
const router = express.Router();
const limite = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde 15 minutos ou fale com a equipe pelo WhatsApp.' },
});

router.get('/', (pedido, resposta) => {
  try { servico.configuracaoEnvio(); resposta.json({ disponivel: true }); }
  catch { resposta.json({ disponivel: false }); }
});
router.post('/', limite, async (pedido, resposta) => {
  resposta.json(await servico.enviar(pedido.body));
});

module.exports = router;
