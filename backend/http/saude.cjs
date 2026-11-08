const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { banco, pastaDados } = require('../dados/banco.cjs');

let ultimaVerificacao;
let ultimoInstante = 0;

function verificar() {
  banco.prepare('SELECT 1').get();
  const pasta = path.join(pastaDados, 'imagens');
  const espaco = fs.statfsSync(pasta);
  if (espaco.bavail * espaco.bsize < 50 * 1024 * 1024) throw new Error('Espaço insuficiente.');
  const prova = path.join(pasta, `.saude-${randomUUID()}`);
  let criado = false;
  try { fs.writeFileSync(prova, 'ok', { flag: 'wx', mode: 0o600 }); criado = true; }
  finally { if (criado) fs.unlinkSync(prova); }
}

function saude(_pedido, resposta) {
  if (ultimaVerificacao === undefined || Date.now() - ultimoInstante > 5000) {
    try { verificar(); ultimaVerificacao = true; }
    catch { ultimaVerificacao = false; }
    ultimoInstante = Date.now();
  }
  resposta.set('Cache-Control', 'no-store').status(ultimaVerificacao ? 200 : 503)
    .json({ status: ultimaVerificacao ? 'ok' : 'indisponivel' });
}

module.exports = { saude };
