const fs = require('node:fs');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { pipeline } = require('node:stream/promises');

const assinatura = Buffer.from('PEREGRINA1');

function lerChave(valor = process.env.BACKUP_CHAVE_CRIPTOGRAFIA) {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(valor)) {
    throw new Error('Configure BACKUP_CHAVE_CRIPTOGRAFIA com uma chave de 32 bytes em Base64.');
  }
  const chave = Buffer.from(valor, 'base64');
  if (chave.length !== 32) throw new Error('Chave de backup inválida.');
  return chave;
}

async function gravar(origem, destino, transformacao, inicio, fim, cabecalho) {
  const fd = fs.openSync(destino, 'wx', 0o600);
  let saida;
  try {
    if (cabecalho) fs.writeSync(fd, cabecalho);
    saida = fs.createWriteStream(destino, { fd, start: cabecalho?.length || 0, autoClose: true });
    await pipeline(fs.createReadStream(origem, { start: inicio, ...(fim === undefined ? {} : { end: fim }) }), transformacao, saida);
  } catch (erro) {
    if (!saida) fs.closeSync(fd);
    fs.rmSync(destino, { force: true });
    throw erro;
  }
}

async function criptografar(origem, destino, chave = lerChave()) {
  const cabecalho = Buffer.concat([assinatura, randomBytes(12)]);
  const cifra = createCipheriv('aes-256-gcm', chave, cabecalho.subarray(assinatura.length));
  cifra.setAAD(cabecalho);
  await gravar(origem, destino, cifra, 0, undefined, cabecalho);
  try { fs.appendFileSync(destino, cifra.getAuthTag()); }
  catch (erro) { fs.rmSync(destino, { force: true }); throw erro; }
}

async function descriptografar(origem, destino, chave = lerChave()) {
  const tamanho = fs.statSync(origem).size;
  const cabecalho = Buffer.alloc(assinatura.length + 12);
  const tag = Buffer.alloc(16);
  if (tamanho <= cabecalho.length + tag.length) throw new Error('Backup criptografado inválido.');
  const fd = fs.openSync(origem, 'r');
  try {
    fs.readSync(fd, cabecalho, 0, cabecalho.length, 0);
    fs.readSync(fd, tag, 0, tag.length, tamanho - tag.length);
  } finally { fs.closeSync(fd); }
  if (!cabecalho.subarray(0, assinatura.length).equals(assinatura)) throw new Error('Formato de backup inválido.');
  const cifra = createDecipheriv('aes-256-gcm', chave, cabecalho.subarray(assinatura.length));
  cifra.setAAD(cabecalho);
  cifra.setAuthTag(tag);
  await gravar(origem, destino, cifra, cabecalho.length, tamanho - tag.length - 1);
}

module.exports = { lerChave, criptografar, descriptografar };
