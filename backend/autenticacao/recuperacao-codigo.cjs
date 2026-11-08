const { randomBytes, randomInt, createHmac, timingSafeEqual } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { banco, transacao } = require('../dados/banco.cjs');
const { exigir } = require('../http/validacao.cjs');
const acesso = require('./servico.cjs');
const { confirmarSenha } = require('./clientes.cjs');
const restricoes = require('./restricoes.cjs');
const gmail = require('./gmail.cjs');

const mensagem = 'Se houver uma conta disponível com esse e-mail, tentaremos enviar um código de 6 dígitos. Confira também o spam. Para reenviar, aguarde um minuto.';
const invalido = 'Código inválido ou expirado. Confira o código ou solicite outro.';
const aleatorio = () => randomBytes(32).toString('hex');
const formato = valor => typeof valor === 'string' && /^[a-f0-9]{64}$/.test(valor);
const protegerCodigo = (desafio, codigo) => createHmac('sha256', desafio).update(codigo).digest('hex');

function contaDisponivel(registro) {
  const usuario = registro && banco.prepare('SELECT * FROM usuarios WHERE id = ? AND ativo = 1').get(registro.usuario_id);
  return usuario && !restricoes.bloqueada(usuario.id)
    && acesso.resumir(usuario.senha_hash) === registro.senha_versao ? usuario : null;
}

function conferirEmail(dados) {
  const endereco = acesso.emailNormalizado(dados?.email);
  const usuario = banco.prepare('SELECT id FROM usuarios WHERE email = ? AND ativo = 1').get(endereco);
  exigir(usuario && !restricoes.bloqueada(usuario.id), 'E-mail incorreto. Confira o endereço cadastrado.');
  return { mensagem: 'E-mail conferido.' };
}

async function solicitar(dados) {
  const endereco = acesso.emailNormalizado(dados?.email);
  const config = gmail.configuracao();
  const desafio = aleatorio();
  const agora = Date.now();
  banco.prepare('DELETE FROM recuperacoes_codigos WHERE expira_em <= ?').run(agora);
  const usuario = banco.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(endereco);
  const anterior = usuario && banco.prepare('SELECT criado_em FROM recuperacoes_codigos WHERE usuario_id = ?').get(usuario.id);
  if (!usuario || restricoes.bloqueada(usuario.id) || (anterior && agora - anterior.criado_em < 60000)) {
    return { mensagem, desafio };
  }
  const codigo = String(randomInt(0, 1000000)).padStart(6, '0');
  const resumo = acesso.resumir(desafio);
  transacao(() => {
    banco.prepare('DELETE FROM recuperacoes_codigos WHERE usuario_id = ?').run(usuario.id);
    banco.prepare('DELETE FROM recuperacoes WHERE usuario_id = ?').run(usuario.id);
    banco.prepare(`INSERT INTO recuperacoes_codigos
      (desafio_hash, usuario_id, codigo_hash, senha_versao, criado_em, expira_em)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(resumo, usuario.id, protegerCodigo(desafio, codigo), acesso.resumir(usuario.senha_hash), agora, agora + 600000);
  });
  try { await gmail.enviarCodigo(endereco, codigo, config); }
  catch {
    banco.prepare('UPDATE recuperacoes_codigos SET tentativas = 5 WHERE desafio_hash = ?').run(resumo);
    console.error('Não foi possível enviar o código de recuperação pelo Gmail. Verifique a configuração.');
  }
  return { mensagem, desafio };
}

function validar(dados) {
  exigir(formato(dados?.desafio), invalido);
  const registro = banco.prepare('SELECT * FROM recuperacoes_codigos WHERE desafio_hash = ?').get(acesso.resumir(dados.desafio));
  exigir(registro && registro.expira_em > Date.now() && registro.tentativas < 5
    && !registro.permissao_hash && contaDisponivel(registro), invalido);
  banco.prepare('UPDATE recuperacoes_codigos SET tentativas = tentativas + 1 WHERE desafio_hash = ?')
    .run(registro.desafio_hash);
  exigir(typeof dados.codigo === 'string' && /^\d{6}$/.test(dados.codigo)
    && timingSafeEqual(Buffer.from(registro.codigo_hash, 'hex'),
      Buffer.from(protegerCodigo(dados.desafio, dados.codigo), 'hex')), invalido);
  const permissao = aleatorio();
  banco.prepare('UPDATE recuperacoes_codigos SET permissao_hash = ? WHERE desafio_hash = ?')
    .run(acesso.resumir(permissao), registro.desafio_hash);
  return { permissao, mensagem: 'Código confirmado. Escolha uma nova senha.' };
}

async function redefinir(dados) {
  exigir(formato(dados?.permissao), 'Confirme o código antes de alterar a senha.');
  const hash = await bcrypt.hash(confirmarSenha(dados), 12);
  transacao(() => {
    const registro = banco.prepare('SELECT * FROM recuperacoes_codigos WHERE permissao_hash = ?')
      .get(acesso.resumir(dados.permissao));
    exigir(registro && registro.expira_em > Date.now() && contaDisponivel(registro),
      'A autorização expirou. Solicite um novo código.');
    banco.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hash, registro.usuario_id);
    banco.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(registro.usuario_id);
    banco.prepare('DELETE FROM recuperacoes WHERE usuario_id = ?').run(registro.usuario_id);
    banco.prepare('DELETE FROM recuperacoes_codigos WHERE usuario_id = ?').run(registro.usuario_id);
  });
  return { mensagem: 'Senha atualizada. Entre novamente com a nova senha.' };
}

module.exports = { solicitar, validar, redefinir, conferirEmail };
