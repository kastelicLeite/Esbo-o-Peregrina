const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { finished } = require('node:stream/promises');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { lerChave, criptografar } = require('./criptografia-backup.cjs');

function configuracao() {
  if (process.env.BACKUP_EXTERNO_ATIVO !== '1') return null;
  const endpoint = new URL(process.env.BACKUP_S3_ENDPOINT || '');
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Endpoint S3 inválido. Use HTTPS sem credenciais na URL.');
  }
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('Bucket inválido.');
  const prefixo = process.env.BACKUP_S3_PREFIXO || 'peregrina';
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(prefixo)) throw new Error('Prefixo inválido.');
  if (!process.env.BACKUP_S3_ACCESS_KEY_ID || !process.env.BACKUP_S3_SECRET_ACCESS_KEY) throw new Error('Credenciais S3 não configuradas.');
  return { bucket, prefixo, chave: lerChave(), cliente: {
    endpoint: endpoint.href, region: process.env.BACKUP_S3_REGIAO || 'auto', forcePathStyle: true,
    credentials: { accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID, secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY },
    maxAttempts: 2, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
  } };
}

function disponibilidade() {
  const ativo = process.env.BACKUP_EXTERNO_ATIVO === '1';
  try { return { ativo, configurado: Boolean(configuracao()), mensagem: ativo ? 'Configurado para envio privado e criptografado.' : 'Desativado. Configure um armazenamento externo para ativar.' }; }
  catch { return { ativo, configurado: false, mensagem: 'Configuração incompleta ou inválida. Confira as variáveis de backup externo no servidor.' }; }
}

function estado(pasta) {
  try {
    const dados = JSON.parse(fs.readFileSync(path.join(pasta, 'externo.json'), 'utf8'));
    return { status: dados.status === 'enviado' ? 'enviado' : 'falha', em: dados.em };
  } catch { return { status: 'pendente', em: null }; }
}

function salvarEstado(pasta, status) {
  const destino = path.join(pasta, 'externo.json');
  const temporario = `${destino}.${randomUUID()}.novo`;
  fs.writeFileSync(temporario, JSON.stringify({ status, em: new Date().toISOString() }), { mode: 0o600 });
  fs.renameSync(temporario, destino);
}

async function resumo(conteudo) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const parte of conteudo) { const buffer = Buffer.from(parte); hash.update(buffer); bytes += buffer.length; }
  return { hash: hash.digest('hex'), bytes };
}

async function enviar({ id, arquivo, pasta }, clienteTeste) {
  const config = configuracao();
  if (!config) return { enviado: false };
  if (!/^(manual|automatico)-\d{13}-[a-f0-9-]{36}$/.test(id)) throw new Error('Identificador de backup inválido.');
  const temporario = path.join(pasta, `.externo-${randomUUID()}.enc`);
  const cliente = clienteTeste || new S3Client(config.cliente);
  let envio;
  let retorno;
  try {
    await criptografar(arquivo, temporario, config.chave);
    const esperado = await resumo(fs.createReadStream(temporario));
    const objeto = { Bucket: config.bucket, Key: `${config.prefixo}/${id}.tar.gz.enc` };
    envio = fs.createReadStream(temporario);
    await cliente.send(new PutObjectCommand({ ...objeto, Body: envio,
      ContentLength: esperado.bytes, ContentType: 'application/octet-stream', Metadata: { sha256: esperado.hash } }),
    { abortSignal: AbortSignal.timeout(120000) });
    retorno = await cliente.send(new GetObjectCommand(objeto), { abortSignal: AbortSignal.timeout(120000) });
    const recebido = await resumo(retorno.Body);
    if (recebido.bytes !== esperado.bytes || recebido.hash !== esperado.hash) throw new Error('A cópia externa não passou na verificação.');
    salvarEstado(pasta, 'enviado');
    return { enviado: true };
  } catch {
    salvarEstado(pasta, 'falha');
    throw new Error('Falha no backup externo. A cópia local foi preservada. Confira as configurações e tente novamente.');
  } finally {
    envio?.destroy();
    retorno?.Body?.destroy?.();
    if (envio) await finished(envio).catch(() => {});
    if (retorno?.Body?.on) await finished(retorno.Body).catch(() => {});
    fs.rmSync(temporario, { force: true });
    if (!clienteTeste) cliente.destroy();
  }
}

module.exports = { disponibilidade, estado, enviar };
