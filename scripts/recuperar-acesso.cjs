const { banco } = require('../backend/dados/banco.cjs');
const { gerarRecuperacao } = require('../backend/autenticacao/servico.cjs');
const { perguntar } = require('./entrada-segura.cjs');

(async () => {
  const email = await perguntar('E-mail da conta a recuperar: ');
  const usuario = banco.prepare("SELECT id FROM usuarios WHERE email = ? COLLATE NOCASE AND perfil IN ('administrador', 'editor', 'criador')").get(email.trim());
  if (!usuario) throw new Error('Conta não encontrada.');
  const token = gerarRecuperacao(usuario.id);
  const origem = process.env.URL_PUBLICA || `http://localhost:${process.env.PORT || 3000}`;
  console.log(`Link válido por 30 minutos:\n${origem}/paginas/recuperar-acesso.html?token=${token}`);
  console.log('Compartilhe somente com o titular da conta. O token não fica no histórico de auditoria.');
  banco.close();
})().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
