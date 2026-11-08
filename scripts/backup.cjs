const path = require('node:path');
const { criarBackup } = require('../backend/manutencao/backup.cjs');
const { banco } = require('../backend/dados/banco.cjs');
const { compactarBackup } = require('../backend/manutencao/pacote-backup.cjs');

try {
  if (process.argv[2]) {
    const destino = path.resolve(process.argv[2]);
    console.log(`Backup concluído: ${criarBackup(destino)}`);
    console.log(`Pacote portátil: ${compactarBackup(destino, path.join(destino, 'backup.tar.gz'))}`);
  } else {
    const agendamento = require('../backend/manutencao/agendamento-backup.cjs');
    const copia = agendamento.criar();
    console.log(`Backup concluído: ${path.join(agendamento.pastaBackups, copia.id, 'backup.tar.gz')}`);
  }
  banco.close();
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
}
