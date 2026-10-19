const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');

const sessoes = new Map();
const duracaoSessao = 60 * 60 * 1000;
const tentativas = new Map();

function cookieSessao(valor, pedido, duracao) {
  const seguro = pedido.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `peregrina_admin=${valor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${duracao}${seguro}`;
}

function atenderAdmin(pedido, resposta) {
  let rota;
  try {
    rota = decodeURIComponent(new URL(pedido.url, 'http://localhost').pathname);
    rota = require('node:path').posix.normalize(rota.replaceAll('\\', '/'));
  } catch {
    resposta.writeHead(400).end();
    return true;
  }

  const paginaAdmin = rota === '/paginas/painel-admin.html';
  if (!paginaAdmin && !rota.startsWith('/admin/')) return false;

  resposta.setHeader('Cache-Control', 'no-store');
  const agora = Date.now();
  for (const [chave, validade] of sessoes) {
    if (validade <= agora) sessoes.delete(chave);
  }
  for (const [chave, dados] of tentativas) {
    if (dados.validade <= agora) tentativas.delete(chave);
  }

  const token = pedido.headers.cookie?.match(/(?:^|;\s*)peregrina_admin=([a-f0-9]+)/)?.[1];

  if (paginaAdmin) {
    if (!sessoes.has(token)) {
      resposta.writeHead(303, { Location: '/' }).end();
      return true;
    }
    return false;
  }

  if (pedido.method !== 'POST') {
    resposta.writeHead(405, { Allow: 'POST' }).end();
    return true;
  }

  if (pedido.headers.origin) {
    try {
      if (new URL(pedido.headers.origin).host !== pedido.headers.host) {
        resposta.writeHead(403).end();
        return true;
      }
    } catch {
      resposta.writeHead(403).end();
      return true;
    }
  }

  if (rota === '/admin/sair') {
    sessoes.delete(token);
    resposta.writeHead(204, { 'Set-Cookie': cookieSessao('', pedido, 0) }).end();
    return true;
  }

  if (rota !== '/admin/entrar') {
    resposta.writeHead(404).end();
    return true;
  }

  const senhaConfigurada = process.env.SENHA_ADMIN;
  if (!senhaConfigurada) {
    resposta.writeHead(503).end();
    return true;
  }

  const origem = pedido.socket.remoteAddress;
  const tentativa = tentativas.get(origem) || { quantidade: 0, validade: agora + 60000 };
  if (tentativa.quantidade >= 10) {
    resposta.writeHead(429).end();
    return true;
  }

  tentativa.quantidade++;
  tentativas.set(origem, tentativa);
  let corpo = '';
  pedido.setEncoding('utf8');
  pedido.on('data', (parte) => {
    corpo += parte;
    if (corpo.length > 2048) pedido.destroy();
  });
  pedido.on('end', () => {
    let senha;
    try {
      senha = JSON.parse(corpo).senha;
    } catch {
      resposta.writeHead(400).end();
      return;
    }

    if (typeof senha !== 'string') {
      resposta.writeHead(400).end();
      return;
    }

    const resumo = (valor) => createHash('sha256').update(valor).digest();
    if (!timingSafeEqual(resumo(senha), resumo(senhaConfigurada))) {
      resposta.writeHead(401).end();
      return;
    }

    const novaSessao = randomBytes(32).toString('hex');
    sessoes.set(novaSessao, Date.now() + duracaoSessao);
    resposta.writeHead(204, {
      'Set-Cookie': cookieSessao(novaSessao, pedido, duracaoSessao / 1000),
    }).end();
  });

  return true;
}

module.exports = { atenderAdmin };
