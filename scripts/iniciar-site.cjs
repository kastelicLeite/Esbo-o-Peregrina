const { spawn } = require('node:child_process');

// Uma porta livre evita conflitos com outros servidores em execução.
process.env.PORT = '0';
process.env.HOST = '127.0.0.1';

const servidor = require('./servidor.cjs');

servidor.once('listening', () => {
  const url = `http://127.0.0.1:${servidor.address().port}`;

  console.log('\nMantenha esta janela aberta enquanto estiver usando o site.');
  console.log('Para encerrar, pressione Ctrl+C ou feche esta janela.\n');

  const navegador = spawn('cmd.exe', ['/d', '/c', 'start', '', url], {
    stdio: 'ignore',
    windowsHide: true,
  });

  navegador.once('error', () => {
    console.log(`Abra este endereço no navegador: ${url}`);
  });

  navegador.once('exit', (codigo) => {
    if (codigo !== 0) {
      console.log(`Abra este endereço no navegador: ${url}`);
    }
  });
});
