const path = require('node:path');
const { descriptografar } = require('../backend/manutencao/criptografia-backup.cjs');

(async () => {
  if (process.argv.length !== 4) throw new Error('Uso: npm run descriptografar-backup -- COPIA.tar.gz.enc SAIDA.tar.gz');
  await descriptografar(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
  console.log('Backup descriptografado e autenticado. Use npm run restaurar para conferir e restaurar o pacote.');
})().catch(() => {
  console.error('Não foi possível descriptografar. Confira os caminhos, a chave e a integridade do arquivo. O destino precisa ser um arquivo novo.');
  process.exitCode = 1;
});
