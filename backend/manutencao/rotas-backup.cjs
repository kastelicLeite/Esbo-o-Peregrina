const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { exigir } = require('../http/validacao.cjs');
const { registrar } = require('../dados/banco.cjs');
const backups = require('./agendamento-backup.cjs');
const externo = require('./backup-externo.cjs');
const router = express.Router();

router.use('/backups', (pedido, resposta, proximo) => {
  exigir(pedido.usuario.perfil === 'criador', 'Os backups completos estão disponíveis somente para Criadores.', 403);
  proximo();
});
const limite = rateLimit({ windowMs: 60000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { erro: 'Aguarde um minuto antes de repetir a operação de backup.' } });

router.get('/backups', (pedido, resposta) => {
  resposta.json({ configuracao: backups.configuracao(), copias: backups.listar(), externo: externo.disponibilidade() });
});
router.post('/backups/externos', limite, async (_pedido, resposta) => {
  exigir(externo.disponibilidade().configurado, 'Configure o armazenamento externo no servidor antes de enviar.', 409);
  resposta.json(await backups.enviarPendentes());
});
router.put('/backups/configuracao', (pedido, resposta) => {
  exigir(typeof pedido.body?.ativo === 'boolean' && [6, 12, 24].includes(Number(pedido.body.intervalo))
    && Number.isInteger(Number(pedido.body.manter)) && Number(pedido.body.manter) >= 1 && Number(pedido.body.manter) <= 30,
  'Confira o intervalo e a retenção.');
  const config = backups.configurar(pedido.body);
  registrar(pedido.usuario, 'Configurou backup automático', 'manutencao', 'backup');
  resposta.json(config);
});
router.post('/backups', limite, (pedido, resposta) => {
  const copia = backups.criar();
  registrar(pedido.usuario, 'Criou backup completo verificado', 'manutencao', copia.id);
  resposta.status(201).json(copia);
});
router.post('/backups/:id/verificar', limite, (pedido, resposta) => {
  resposta.json(backups.verificar(pedido.params.id));
});
router.get('/backups/:id/baixar', limite, (pedido, resposta) => {
  const arquivo = backups.baixar(pedido.params.id);
  registrar(pedido.usuario, 'Baixou backup completo', 'manutencao', pedido.params.id);
  resposta.download(arquivo, `peregrina-${pedido.params.id}.tar.gz`);
});

module.exports = router;
