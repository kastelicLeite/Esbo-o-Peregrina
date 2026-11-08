const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const aplicacao = require('../backend/aplicacao.cjs');
const { pastaDados, banco } = require('../backend/dados/banco.cjs');
const { iniciarAgendamento } = require('../backend/manutencao/agendamento-backup.cjs');

const porta = Number(process.env.PORT || 3000);
const endereco = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const arquivoTrava = path.join(process.env.RAILWAY_ENVIRONMENT_ID ? os.tmpdir() : pastaDados, 'servidor.pid');

if (fs.existsSync(arquivoTrava)) {
  const pid = Number(fs.readFileSync(arquivoTrava, 'utf8'));
  let ativo = false;
  try { process.kill(pid, 0); ativo = true; } catch {}
  if (ativo && pid !== process.pid) throw new Error('Este banco já está em uso por outro servidor. Encerre-o antes de continuar.');
  fs.unlinkSync(arquivoTrava);
}
fs.writeFileSync(arquivoTrava, String(process.pid), { flag: 'wx' });

const servidor = http.createServer(aplicacao);
const pararAgendamento = iniciarAgendamento();
servidor.listen(porta, endereco, () => {
  console.log(`Site disponível em http://${endereco}:${servidor.address().port}`);
});

process.once('exit', () => {
  if (fs.existsSync(arquivoTrava) && fs.readFileSync(arquivoTrava, 'utf8') === String(process.pid)) {
    fs.unlinkSync(arquivoTrava);
  }
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.once(sinal, () => {
    pararAgendamento();
    servidor.close(() => {
      banco.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

module.exports = servidor;
