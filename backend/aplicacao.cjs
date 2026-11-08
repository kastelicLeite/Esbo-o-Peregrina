const express = require('express');
const helmet = require('helmet');
const fs = require('node:fs');
const path = require('node:path');
const { banco, pastaDados } = require('./dados/banco.cjs');
const { ErroPublico } = require('./http/validacao.cjs');
const autenticacao = require('./autenticacao/servico.cjs');
const acessoPainel = require('./autenticacao/acesso-painel.cjs');
const produtos = require('./produtos/servico.cjs');
const conteudo = require('./conteudo/servico.cjs');
const { version: versaoSite } = require('../package.json');

const aplicacao = express();
const frontend = path.resolve(__dirname, '../frontend');
aplicacao.disable('x-powered-by');
if (process.env.CONFIAR_PROXY === '1') aplicacao.set('trust proxy', 1);
else if (process.env.CONFIAR_PROXY === 'loopback') aplicacao.set('trust proxy', 'loopback');
aplicacao.use(helmet({
  contentSecurityPolicy: {
    directives: { 'img-src': ["'self'", 'blob:'], 'upgrade-insecure-requests': null },
  },
  referrerPolicy: { policy: 'no-referrer' },
}));
aplicacao.use(express.json({ limit: '400kb' }));
aplicacao.get('/saude', require('./http/saude.cjs').saude);
aplicacao.use((pedido, resposta, proximo) => {
  if (pedido.path.startsWith('/api/')) resposta.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(pedido.method) && pedido.get('Origin')) {
    try {
      if (new URL(pedido.get('Origin')).host !== pedido.get('Host')) {
        return resposta.status(403).json({ erro: 'Origem de requisição inválida.' });
      }
    } catch {
      return resposta.status(403).json({ erro: 'Origem de requisição inválida.' });
    }
  }
  proximo();
});

aplicacao.use('/api/acesso', require('./autenticacao/rotas.cjs'));
aplicacao.use('/api/painel/acesso', acessoPainel.rotas);
aplicacao.get('/paginas/entrar.html', (pedido, resposta) => {
  resposta.set('Cache-Control', 'no-store').redirect(303, '/paginas/entrar-conta.html');
});
aplicacao.use('/api/conta', require('./autenticacao/clientes-rotas.cjs'));
aplicacao.use('/api/contato', require('./contato/rotas.cjs'));
aplicacao.use('/api/orcamento', require('./produtos/orcamento.cjs').router);
aplicacao.get('/api/produtos', (pedido, resposta) => resposta.json(produtos.listarPublicos()));
aplicacao.get('/api/produtos/:slug', (pedido, resposta) => {
  const produto = produtos.listarPublicos().find((item) => item.slug === pedido.params.slug);
  if (!produto) return resposta.status(404).json({ erro: 'Produto não encontrado.' });
  resposta.json(produto);
});
aplicacao.get('/api/site', (pedido, resposta) => resposta.json(conteudo.site()));
aplicacao.get('/api/categorias', (pedido, resposta) => {
  resposta.json(banco.prepare('SELECT id, nome, slug FROM categorias WHERE ativa = 1 ORDER BY posicao, nome').all());
});

const painel = express.Router();
painel.use(autenticacao.autenticar, autenticacao.equipe, autenticacao.protegerEscrita, acessoPainel.proteger);
painel.use(require('./produtos/administracao.cjs'));
painel.use(require('./produtos/edicao-rapida.cjs'));
painel.use(require('./midias/rotas.cjs'));
painel.use(require('./manutencao/rotas-backup.cjs'));
painel.use(require('./conteudo/rotas.cjs'));
painel.use(require('./manual/rotas.cjs'));
painel.use(require('./dados/visualizador.cjs'));
aplicacao.use('/api/admin', painel);

aplicacao.use((pedido, resposta, proximo) => {
  let caminho;
  try {
    caminho = path.posix.normalize(decodeURIComponent(pedido.path).replaceAll('\\', '/'))
      .split('/').map((parte) => parte.replace(/[. ]+$/, '')).join('/').toLowerCase();
  } catch {
    return proximo();
  }
  if (caminho !== '/paginas/painel-admin.html') return proximo();
  resposta.set('Cache-Control', 'no-store');
  const usuario = autenticacao.sessao(pedido);
  if (!usuario) return resposta.redirect(303, '/paginas/entrar.html');
  if (usuario.perfil === 'cliente') return resposta.status(403).send('Acesso restrito à equipe.');
  if (!acessoPainel.liberado(usuario)) return resposta.redirect(303, '/paginas/acesso-painel.html');
  resposta.sendFile(path.join(frontend, 'paginas/painel-admin.html'));
});

const arquivosVisualizador = new Map([
  ['/admin/banco', 'banco-de-dados.html'],
  ['/paginas/banco-de-dados.html', 'banco-de-dados.html'],
  ['/admin/banco/visualizador.js', 'banco-de-dados.js'],
  ['/admin/banco/visualizador.css', 'banco-de-dados.css'],
]);
aplicacao.get([...arquivosVisualizador.keys()], (pedido, resposta) => {
  resposta.set('Cache-Control', 'no-store');
  const usuario = autenticacao.sessao(pedido);
  if (!usuario) return resposta.redirect(303, '/paginas/entrar.html');
  if (!['administrador', 'criador'].includes(usuario.perfil)) return resposta.status(403).send('Acesso restrito à administração.');
  if (!acessoPainel.tabelasLiberadas(usuario)) return resposta.redirect(303, '/paginas/acesso-painel.html?destino=banco');
  resposta.sendFile(path.join(__dirname, 'visualizador', arquivosVisualizador.get(pedido.path)));
});

const escapar = (valor) => String(valor || '').replace(/[&<>"']/g, (letra) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[letra]);

function paginaPublica(arquivo, resposta, produto) {
  const config = conteudo.configuracoes();
  let html = fs.readFileSync(path.join(frontend, 'paginas', arquivo), 'utf8');
  html = html.replace(/(<span[^>]*data-versao-site[^>]*>)[^<]*(<\/span>)/,
    `$1Versão ${escapar(versaoSite)}$2`);
  const titulo = produto ? `${produto.nome} | ${config.compartilhamento}`
    : arquivo === 'index.html' ? config.titulo : `Produtos | ${config.compartilhamento}`;
  const descricao = produto ? produto.descricao.slice(0, 180) : config.descricao;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapar(titulo)}</title>`);
  html = html.replace(/<meta\s+name="description"[\s\S]*?>/, `<meta name="description" content="${escapar(descricao)}">`);
  const imagem = produto?.imagem || produtos.imagem(config.imagem_compartilhamento);
  const favicon = produtos.imagem(config.favicon);
  const metadados = [
    `<meta property="og:title" content="${escapar(produto ? titulo : config.compartilhamento || titulo)}">`,
    `<meta property="og:description" content="${escapar(descricao)}">`,
    imagem ? `<meta property="og:image" content="${escapar((process.env.URL_PUBLICA || '') + imagem.url)}">` : '',
    favicon ? `<link rel="icon" href="${escapar(favicon.url)}" type="image/webp">` : '',
  ].filter(Boolean).join('\n    ');
  html = html.replace('</head>', `    ${metadados}\n  </head>`);
  resposta.set('Cache-Control', 'no-store').type('html').send(html);
}

for (const rota of ['/', '/index.html', '/paginas/index.html']) {
  aplicacao.get(rota, (pedido, resposta) => paginaPublica('index.html', resposta));
}
aplicacao.get('/paginas/produtos.html', (pedido, resposta) => paginaPublica('produtos.html', resposta));
aplicacao.get('/paginas/produto.html', (pedido, resposta) => {
  const produto = produtos.listarPublicos().find((item) => item.slug === pedido.query.produto);
  if (!produto) return resposta.status(404).sendFile(path.join(frontend, 'paginas/nao-encontrado.html'));
  paginaPublica('produto.html', resposta, produto);
});
aplicacao.get('/produtos/:slug', (pedido, resposta) => {
  const produto = produtos.listarPublicos().find((item) => item.slug === pedido.params.slug);
  if (!produto) return resposta.status(404).sendFile(path.join(frontend, 'paginas/nao-encontrado.html'));
  paginaPublica('produto.html', resposta, produto);
});
aplicacao.get('/midias/:arquivo', (pedido, resposta) => {
  const midia = banco.prepare('SELECT 1 FROM midias WHERE arquivo = ? OR miniatura = ?')
    .get(pedido.params.arquivo, pedido.params.arquivo);
  if (!midia) return resposta.sendStatus(404);
  resposta.set('Cache-Control', 'public, max-age=3600');
  resposta.sendFile(path.join(pastaDados, 'imagens', pedido.params.arquivo));
});
aplicacao.use(express.static(frontend, { index: false, maxAge: 0, dotfiles: 'deny' }));

aplicacao.use((pedido, resposta) => resposta.status(404).json({ erro: 'Endereço não encontrado.' }));
aplicacao.use((erro, pedido, resposta, proximo) => {
  if (resposta.headersSent) return proximo(erro);
  if (erro instanceof ErroPublico) return resposta.status(erro.status).json({ erro: erro.message });
  if (erro.code === 'LIMIT_FILE_SIZE') return resposta.status(413).json({ erro: 'Envie imagens com até 8 MB.' });
  if (erro.name === 'MulterError') return resposta.status(400).json({ erro: 'Envie uma imagem por vez no campo indicado.' });
  if (erro.type === 'entity.too.large') return resposta.status(413).json({ erro: 'A requisição é muito grande.' });
  if (erro instanceof SyntaxError && erro.status === 400) return resposta.status(400).json({ erro: 'Dados inválidos.' });
  if (erro.code?.startsWith('ERR_SQLITE') && /UNIQUE/.test(erro.message)) {
    return resposta.status(409).json({ erro: 'Há um endereço, e-mail ou combinação já cadastrado. Confira os dados.' });
  }
  console.error('Falha interna na operação:', pedido.method, pedido.path);
  resposta.status(500).json({ erro: 'Não foi possível concluir. Seus dados no formulário foram preservados.' });
});

module.exports = aplicacao;
