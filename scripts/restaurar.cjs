const { restaurarBackup } = require('../backend/manutencao/backup.cjs');
const { extrairBackup } = require('../backend/manutencao/pacote-backup.cjs');
const { pastaDados } = require('../backend/dados/banco.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
let temporaria;

try {
  if (!process.argv[2] || !process.argv.includes('--confirmar')
    || process.argv.slice(3).some(item => !['--confirmar', '--restaurar-ambiente'].includes(item))) {
    throw new Error('Uso: npm run restaurar -- CAMINHO_DO_BACKUP --confirmar [--restaurar-ambiente]. Encerre o servidor antes.');
  }
  let origem = path.resolve(process.argv[2]);
  if (fs.statSync(origem).isFile()) {
    temporaria = path.join(pastaDados, `.restaurar-${randomUUID()}`);
    origem = extrairBackup(origem, temporaria);
  }
  const seguranca = restaurarBackup(origem, { ambiente: process.argv.includes('--restaurar-ambiente') });
  console.log(`Restauração concluída. Cópia anterior preservada em: ${seguranca}`);
  console.log('Todas as sessões e links de recuperação foram encerrados.');
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  if (temporaria && path.dirname(path.resolve(temporaria)) === path.resolve(pastaDados)
    && path.basename(temporaria).startsWith('.restaurar-')) {
    fs.rmSync(temporaria, { recursive: true, force: true });
  }
}
