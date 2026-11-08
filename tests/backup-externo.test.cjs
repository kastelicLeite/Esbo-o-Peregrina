const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { criptografar, descriptografar, lerChave } = require('../backend/manutencao/criptografia-backup.cjs');
const externo = require('../backend/manutencao/backup-externo.cjs');

test('backup criptografado autentica conteúdo, rejeita adulteração e não sobrescreve arquivos', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'peregrina-cripto-'));
  try {
    const origem = path.join(pasta, 'original.tar.gz');
    const cifrado = path.join(pasta, 'original.enc');
    const saida = path.join(pasta, 'restaurado.tar.gz');
    const chave = randomBytes(32);
    const dados = randomBytes(1024 * 1024);
    fs.writeFileSync(origem, dados);
    await criptografar(origem, cifrado, chave);
    assert.notDeepEqual(fs.readFileSync(cifrado), dados);
    await descriptografar(cifrado, saida, chave);
    assert.deepEqual(fs.readFileSync(saida), dados);
    await assert.rejects(descriptografar(cifrado, saida, chave), /EEXIST/);
    assert.deepEqual(fs.readFileSync(saida), dados);
    const falha = path.join(pasta, 'falha.tar.gz');
    await assert.rejects(descriptografar(cifrado, falha, randomBytes(32)));
    assert.equal(fs.existsSync(falha), false);
    const adulterado = fs.readFileSync(cifrado);
    adulterado[40] ^= 1;
    fs.writeFileSync(cifrado, adulterado);
    await assert.rejects(descriptografar(cifrado, falha, chave));
    assert.equal(fs.existsSync(falha), false);
    assert.throws(() => lerChave('invalida'));
  } finally { fs.rmSync(pasta, { recursive: true, force: true }); }
});

test('backup externo fica desativado por padrão e só confirma após conferir o objeto remoto', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'peregrina-externo-'));
  const variaveis = ['BACKUP_EXTERNO_ATIVO', 'BACKUP_S3_ENDPOINT', 'BACKUP_S3_BUCKET', 'BACKUP_S3_ACCESS_KEY_ID',
    'BACKUP_S3_SECRET_ACCESS_KEY', 'BACKUP_CHAVE_CRIPTOGRAFIA', 'BACKUP_S3_PREFIXO'];
  const anteriores = Object.fromEntries(variaveis.map(chave => [chave, process.env[chave]]));
  try {
    for (const chave of variaveis) delete process.env[chave];
    assert.equal(externo.disponibilidade().ativo, false);
    let requisicoes = 0;
    let armazenado;
    let corromper = false;
    const cliente = { send: async (comando) => {
      requisicoes++;
      assert.equal(comando.input.Bucket, 'bucket-privado-teste');
      if (comando instanceof PutObjectCommand) {
        const partes = [];
        for await (const parte of comando.input.Body) partes.push(parte);
        armazenado = Buffer.concat(partes);
        assert.equal(armazenado.length, comando.input.ContentLength);
        assert.equal(comando.input.Key.endsWith('.tar.gz.enc'), true);
        return {};
      }
      assert.ok(comando instanceof GetObjectCommand);
      return { Body: Readable.from([corromper ? Buffer.from('objeto adulterado') : armazenado]) };
    } };
    const arquivo = path.join(pasta, 'backup.tar.gz');
    const original = Buffer.from('contas protegidas e imagens de teste');
    fs.writeFileSync(arquivo, original);
    const copia = { id: `manual-${Date.now()}-${randomUUID()}`, arquivo, pasta };
    assert.equal((await externo.enviar(copia, cliente)).enviado, false);
    assert.equal(requisicoes, 0);
    Object.assign(process.env, { BACKUP_EXTERNO_ATIVO: '1', BACKUP_S3_ENDPOINT: 'https://storage.example.test',
      BACKUP_S3_BUCKET: 'bucket-privado-teste', BACKUP_S3_ACCESS_KEY_ID: 'apenas-teste',
      BACKUP_S3_SECRET_ACCESS_KEY: 'segredo-apenas-teste', BACKUP_CHAVE_CRIPTOGRAFIA: randomBytes(32).toString('base64') });
    assert.equal(externo.disponibilidade().configurado, true);
    assert.equal((await externo.enviar(copia, cliente)).enviado, true);
    assert.equal(requisicoes, 2);
    assert.equal(armazenado.includes(original), false);
    assert.equal(externo.estado(pasta).status, 'enviado');
    assert.equal(fs.readdirSync(pasta).some(nome => nome.startsWith('.externo-')), false);
    corromper = true;
    await assert.rejects(externo.enviar(copia, cliente), /cópia local foi preservada/);
    assert.deepEqual(fs.readFileSync(arquivo), original);
    assert.equal(externo.estado(pasta).status, 'falha');
    assert.equal(fs.readdirSync(pasta).some(nome => nome.startsWith('.externo-')), false);
    await assert.rejects(externo.enviar(copia, { send: async () => { throw new Error('credencial-de-teste'); } }),
      /cópia local foi preservada/);
    assert.equal(fs.readdirSync(pasta).some(nome => nome.startsWith('.externo-')), false);
    process.env.BACKUP_S3_ENDPOINT = 'http://storage.example.test';
    assert.equal(externo.disponibilidade().configurado, false);
    assert.equal(JSON.stringify(externo.disponibilidade()).includes('segredo-apenas-teste'), false);
  } finally {
    for (const [chave, valor] of Object.entries(anteriores)) {
      if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor;
    }
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
