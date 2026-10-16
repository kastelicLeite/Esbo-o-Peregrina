const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..', 'frontend');
const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const servidor = http.createServer((pedido, resposta) => {
  let caminho;

  try {
    const endereco = new URL(pedido.url, 'http://localhost');
    caminho = path.resolve(raiz, '.' + decodeURIComponent(endereco.pathname));
  } catch {
    resposta.writeHead(400).end();
    return;
  }
  if (caminho === raiz) {
    caminho = path.join(raiz, 'index.html');
  }

  if (!caminho.startsWith(raiz + path.sep)) {
    resposta.writeHead(403).end();
    return;
  }

  fs.readFile(caminho, (erro, conteudo) => {
    if (erro) {
      resposta.writeHead(404).end();
      return;
    }

    resposta.writeHead(200, {
      'Content-Type': tipos[path.extname(caminho)] || 'application/octet-stream',
    });
    resposta.end(conteudo);
  });
});

servidor.listen(4173, '127.0.0.1', () => {
  console.log('Prévia local: http://127.0.0.1:4173');
});
