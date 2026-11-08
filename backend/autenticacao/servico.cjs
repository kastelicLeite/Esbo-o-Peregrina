const bcrypt = require('bcryptjs');
const { randomBytes, createHash } = require('node:crypto');
const { banco, transacao, registrar } = require('../dados/banco.cjs');
const { exigir, texto } = require('../http/validacao.cjs');
const { validarNome } = require('./nomes.cjs');
const restricoes = require('./restricoes.cjs');
const { exigirGestao, exigirPerfil } = require('./permissoes.cjs');

const resumir = (valor) => createHash('sha256').update(valor).digest('hex');
const senhaInexistente = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);

function publico(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    ativo: Boolean(usuario.ativo),
  };
}

function validarSenha(senha) {
  exigir(typeof senha === 'string' && senha.length >= 12 && Buffer.byteLength(senha) <= 72,
    'Use uma senha de 12 a 72 bytes, com letras e números.');
  exigir(/[a-zA-Z]/.test(senha) && /\d/.test(senha), 'A senha precisa incluir letras e números.');
  return senha;
}

function emailNormalizado(valor) {
  const email = texto(valor, 180, 'o e-mail').toLowerCase();
  exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Informe um e-mail válido.');
  return email;
}

async function criarUsuario(dados, autor) {
  exigir(dados && typeof dados === 'object', 'Informe os dados da conta.');
  const nome = texto(dados.nome, 100, 'o nome');
  const email = emailNormalizado(dados.email);
  exigir(['cliente', 'administrador', 'editor', 'criador'].includes(dados.perfil), 'Escolha o perfil da conta.');
  exigirPerfil(dados.perfil, autor);
  exigir(!banco.prepare('SELECT id FROM usuarios WHERE email = ?').get(email), 'Esse e-mail já está cadastrado.');
  const hash = await bcrypt.hash(validarSenha(dados.senha), 12);

  return transacao(() => {
    const nomeUnico = validarNome(nome);
    const usuario = banco.prepare(`
      INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?) RETURNING *
    `).get(nomeUnico, email, hash, dados.perfil);
    registrar(autor, 'Criou conta', 'equipe', usuario.id);
    return publico(usuario);
  });
}

async function entrar(email, senha, tipo = 'todos') {
  const emailInformado = typeof email === 'string' ? email.trim().slice(0, 180) : '';
  const usuario = banco.prepare('SELECT * FROM usuarios WHERE email = ? COLLATE NOCASE').get(emailInformado);
  const senhaValida = typeof senha === 'string' && Buffer.byteLength(senha) <= 72;
  const valida = await bcrypt.compare(senhaValida ? senha : '',
    usuario?.senha_hash || senhaInexistente);
  exigir(valida && senhaValida && usuario?.ativo && !restricoes.bloqueada(usuario.id)
    && (tipo === 'todos' || (tipo === 'cliente' ? usuario.perfil === 'cliente' : usuario.perfil !== 'cliente')),
  'E-mail ou senha incorretos.', 401);

  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  transacao(() => {
    const atual = banco.prepare('SELECT senha_hash, ativo, perfil FROM usuarios WHERE id = ?').get(usuario.id);
    exigir(atual?.ativo && !restricoes.bloqueada(usuario.id)
      && atual.senha_hash === usuario.senha_hash && atual.perfil === usuario.perfil,
      'E-mail ou senha incorretos.', 401);
    banco.prepare('INSERT INTO sessoes VALUES (?, ?, ?, ?)')
      .run(resumir(token), usuario.id, csrf, Date.now() + 8 * 60 * 60 * 1000);
  });
  return { token, csrf, usuario: publico(usuario) };
}

function cookie(valor, seguro, expirar = false) {
  return `peregrina_admin=${valor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${expirar ? 0 : 28800}${seguro || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

function sessao(pedido) {
  const token = pedido.headers.cookie?.match(/(?:^|;\s*)peregrina_admin=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  banco.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(Date.now());
  const usuario = banco.prepare(`
    SELECT usuarios.*, sessoes.csrf, sessoes.token_hash
    FROM sessoes JOIN usuarios ON usuarios.id = sessoes.usuario_id
    WHERE token_hash = ? AND ativo = 1 AND expira_em > ?
  `).get(resumir(token), Date.now());
  return usuario && !restricoes.bloqueada(usuario.id) ? usuario : null;
}

function autenticar(pedido, resposta, proximo) {
  const usuario = sessao(pedido);
  exigir(usuario, 'Entre novamente para continuar.', 401);
  pedido.usuario = usuario;
  proximo();
}

function administrador(pedido, resposta, proximo) {
  exigir(['administrador', 'criador'].includes(pedido.usuario.perfil), 'Esta ação exige um administrador.', 403);
  proximo();
}

function equipe(pedido, resposta, proximo) {
  exigir(['administrador', 'editor', 'criador'].includes(pedido.usuario.perfil), 'Acesso restrito à equipe.', 403);
  proximo();
}

function cliente(pedido, resposta, proximo) {
  exigir(pedido.usuario.perfil === 'cliente', 'Entre com uma conta de cliente.', 403);
  proximo();
}

function exigirContaEquipe(id) {
  const usuario = banco.prepare("SELECT * FROM usuarios WHERE id = ? AND perfil IN ('administrador', 'editor', 'criador')").get(id);
  exigir(usuario, 'Conta da equipe não encontrada.', 404);
  return usuario;
}

function protegerEscrita(pedido, resposta, proximo) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(pedido.method)) {
    exigir(pedido.get('X-CSRF-Token') === pedido.usuario.csrf,
      'Sua sessão mudou. Recarregue o painel e tente novamente.', 403);
  }
  proximo();
}

function alterarUsuario(id, dados, autor) {
  exigir(dados && typeof dados === 'object', 'Informe os dados da conta.');
  return transacao(() => {
    const usuario = exigirContaEquipe(id);
    exigirGestao(usuario, autor);
    exigirPerfil(dados.perfil, autor);
    exigir(['cliente', 'administrador', 'editor', 'criador'].includes(dados.perfil), 'Perfil inválido.');
    const ativo = dados.ativo ? 1 : 0;
    const total = restricoes.contarAdministradores();
    exigir(!(usuario.ativo && !restricoes.bloqueada(id) && ['administrador', 'criador'].includes(usuario.perfil) && total <= 1
      && (!ativo || !['administrador', 'criador'].includes(dados.perfil))), 'Mantenha ao menos um administrador ativo.');
    exigir(usuario.perfil === dados.perfil || autor?.perfil === 'criador'
      || (!['administrador', 'criador'].includes(usuario.perfil)
        && !['administrador', 'criador'].includes(dados.perfil)),
    'Somente um Criador pode promover ou rebaixar administradores.', 403);
    banco.prepare('UPDATE usuarios SET nome = ?, perfil = ?, ativo = ? WHERE id = ?')
      .run(validarNome(dados.nome, id), dados.perfil, ativo, id);
    banco.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(id);
    banco.prepare('DELETE FROM recuperacoes WHERE usuario_id = ?').run(id);
    banco.prepare('DELETE FROM recuperacoes_codigos WHERE usuario_id = ?').run(id);
    registrar(autor, 'Atualizou conta e encerrou sessões', 'equipe', id);
    return publico(banco.prepare('SELECT * FROM usuarios WHERE id = ?').get(id));
  });
}

function gerarRecuperacao(id, autor, tipo = 'equipe') {
  const usuario = banco.prepare('SELECT * FROM usuarios WHERE id = ? AND ativo = 1').get(id);
  exigir(usuario && !restricoes.bloqueada(id)
    && (tipo === 'cliente' ? usuario.perfil === 'cliente' : usuario.perfil !== 'cliente'),
    'Conta ativa não encontrada.', 404);
  if (tipo === 'equipe' && autor) exigirGestao(usuario, autor);
  const token = randomBytes(32).toString('hex');
  transacao(() => {
    banco.prepare('DELETE FROM recuperacoes WHERE usuario_id = ? OR expira_em < ?').run(id, Date.now());
    banco.prepare('DELETE FROM recuperacoes_codigos WHERE usuario_id = ?').run(id);
    banco.prepare('INSERT INTO recuperacoes VALUES (?, ?, ?)')
      .run(resumir(token), id, Date.now() + 30 * 60 * 1000);
    if (tipo === 'equipe') registrar(autor, 'Gerou recuperação temporária', 'equipe', id);
  });
  return token;
}

async function recuperar(token, senha, tipo = 'equipe') {
  exigir(typeof token === 'string' && /^[a-f0-9]{64}$/.test(token), 'Link inválido ou expirado.');
  const hash = await bcrypt.hash(validarSenha(senha), 12);
  transacao(() => {
    const registro = banco.prepare(`
      SELECT r.usuario_id, u.nome, u.perfil FROM recuperacoes r JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.token_hash = ? AND r.expira_em > ? AND u.ativo = 1
    `).get(resumir(token), Date.now());
    exigir(registro && !restricoes.bloqueada(registro.usuario_id)
      && (tipo === 'cliente' ? registro.perfil === 'cliente' : registro.perfil !== 'cliente'),
      'Link inválido ou expirado.');
    banco.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hash, registro.usuario_id);
    banco.prepare('DELETE FROM recuperacoes WHERE usuario_id = ?').run(registro.usuario_id);
    banco.prepare('DELETE FROM recuperacoes_codigos WHERE usuario_id = ?').run(registro.usuario_id);
    banco.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(registro.usuario_id);
    if (tipo === 'equipe') registrar({ id: registro.usuario_id, nome: registro.nome },
      'Redefiniu a senha por recuperação', 'equipe', registro.usuario_id);
  });
}

function alterarPerfil(id, dados, autor) {
  exigir(Number.isSafeInteger(id) && id > 0, 'Conta inválida.');
  exigir(autor?.perfil === 'criador', 'Somente um Criador pode promover contas.', 403);
  exigir(['administrador', 'criador'].includes(dados?.perfil), 'Escolha Administrador ou Criador.');
  return transacao(() => {
    const usuario = banco.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    exigir(usuario, 'Conta não encontrada.', 404);
    exigirGestao(usuario, autor);
    banco.prepare('UPDATE usuarios SET perfil = ? WHERE id = ?').run(dados.perfil, id);
    banco.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(id);
    banco.prepare('DELETE FROM recuperacoes WHERE usuario_id = ?').run(id);
    banco.prepare('DELETE FROM recuperacoes_codigos WHERE usuario_id = ?').run(id);
    registrar(autor, `Alterou perfil para ${dados.perfil}`, 'contas', id);
    return publico(banco.prepare('SELECT * FROM usuarios WHERE id = ?').get(id));
  });
}

module.exports = {
  publico, criarUsuario, entrar, cookie, sessao, autenticar, administrador,
  protegerEscrita, alterarUsuario, gerarRecuperacao, recuperar,
  validarSenha, emailNormalizado, resumir, equipe, cliente, exigirContaEquipe,
  alterarPerfil,
};
