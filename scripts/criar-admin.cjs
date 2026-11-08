const fs = require('node:fs');
const { banco } = require('../backend/dados/banco.cjs');
const { criarUsuario } = require('../backend/autenticacao/servico.cjs');
const { perguntar } = require('./entrada-segura.cjs');

(async () => {
  if (banco.prepare("SELECT id FROM usuarios WHERE perfil IN ('administrador', 'editor', 'criador') LIMIT 1").get()) {
    throw new Error('A primeira conta já existe. Use o painel para gerenciar a equipe.');
  }

  const dados = process.argv.includes('--stdin')
    ? JSON.parse(fs.readFileSync(0, 'utf8'))
    : {
      nome: await perguntar('Nome do administrador: '),
      email: await perguntar('E-mail: '),
      senha: await perguntar('Senha (mínimo de 12 caracteres, com letras e números): ', true),
    };

  await criarUsuario({ ...dados, perfil: 'administrador' });
  console.log('Administrador criado. Entre pelo botão Painel Admin no site.');
  banco.close();
})().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
