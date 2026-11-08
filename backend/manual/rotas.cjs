const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const rotas = express.Router();
const html = fs.readFileSync(path.join(__dirname, 'conteudo.html'), 'utf8');

rotas.get('/manual', (_pedido, resposta) => {
  resposta.set('Cache-Control', 'no-store').json({ html });
});

module.exports = rotas;
