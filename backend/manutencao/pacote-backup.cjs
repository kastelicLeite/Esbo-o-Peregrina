const fs = require('node:fs');
const path = require('node:path');
const tar = require('tar');
const { validarBackup } = require('./backup.cjs');

function compactarBackup(origem, destino) {
  const manifesto = validarBackup(origem);
  tar.c({ cwd: origem, file: destino, gzip: true, sync: true, portable: true, noMtime: true },
    ['manifesto.json', ...manifesto.arquivos.map(item => item.nome)]);
  fs.chmodSync(destino, 0o600);
  return destino;
}

function extrairBackup(arquivo, destino) {
  if (fs.statSync(arquivo).size > 256 * 1024 * 1024) throw new Error('Use um pacote de até 256 MB.');
  if (fs.existsSync(destino)) throw new Error('A pasta temporária já existe.');
  fs.mkdirSync(destino, { recursive: true });
  let bytes = 0;
  const nomes = new Set();
  tar.x({ file: arquivo, cwd: destino, sync: true, strict: true,
    filter: (nome, entrada) => {
      const permitido = nome === 'imagens/' || ['banco.sqlite', 'manifesto.json', 'ambiente.env'].includes(nome)
        || /^imagens\/[a-f0-9-]+(?:-mini)?\.webp$/.test(nome);
      bytes += entrada.size || 0;
      if (!permitido || !['File', 'Directory'].includes(entrada.type) || nomes.has(nome)
        || (entrada.type === 'Directory' && nome !== 'imagens/')
        || bytes > 512 * 1024 * 1024 || nomes.size > 30000) throw new Error('Pacote de backup inválido.');
      nomes.add(nome);
      return true;
    },
  });
  validarBackup(destino);
  return destino;
}

module.exports = { compactarBackup, extrairBackup };
