const readline = require('node:readline/promises');

async function perguntar(rotulo, segredo = false) {
  if (!segredo) {
    const leitor = readline.createInterface({ input: process.stdin, output: process.stdout });
    const resposta = await leitor.question(rotulo);
    leitor.close();
    return resposta;
  }

  if (!process.stdin.isTTY) throw new Error('Use um terminal interativo ou a opção --stdin.');
  process.stdout.write(rotulo);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  return new Promise((resolver, rejeitar) => {
    let valor = '';
    const terminar = () => {
      process.stdin.off('data', receber);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const receber = (dados) => {
      for (const caractere of dados) {
        if (caractere === '\u0003') {
          terminar();
          rejeitar(new Error('Operação cancelada.'));
          return;
        }
        if (caractere === '\r' || caractere === '\n') {
          terminar();
          resolver(valor);
          return;
        }
        if (caractere === '\u007f' || caractere === '\b') valor = valor.slice(0, -1);
        else if (caractere >= ' ') valor += caractere;
      }
    };
    process.stdin.on('data', receber);
  });
}

module.exports = { perguntar };
