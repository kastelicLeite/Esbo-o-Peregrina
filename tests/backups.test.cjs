const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const tar = require('tar');

test('backups online, agendamento, retenção, permissões e restauração portátil', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'peregrina-backups-'));
  process.env.PASTA_DADOS = pasta;
  process.env.PASTA_BACKUPS = path.join(pasta, 'backups');
  process.env.ARQUIVO_AMBIENTE = path.join(pasta, '.env');
  process.env.NODE_ENV = 'test';
  fs.writeFileSync(process.env.ARQUIVO_AMBIENTE, 'GMAIL_USUARIO=backup@example.test\nGMAIL_REFRESH_TOKEN=segredo-apenas-teste\n');
  const { banco } = require('../backend/dados/banco.cjs');
  const backup = require('../backend/manutencao/backup.cjs');
  const pacotes = require('../backend/manutencao/pacote-backup.cjs');
  const agendamento = require('../backend/manutencao/agendamento-backup.cjs');
  const acesso = require('../backend/autenticacao/servico.cjs');
  const senha = 'SenhaBackupTeste123!';
  const hash = await bcrypt.hash(senha, 12);
  let servidor;
  try {
    for (const [id, perfil] of [[1, 'cliente'], [2, 'criador'], [3, 'administrador'], [4, 'editor']]) {
      banco.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)')
        .run(id, `Conta ${id}`, `conta${id}@example.test`, hash, perfil);
    }
    const id = randomUUID();
    const imagem = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#00aeef' } }).webp().toBuffer();
    for (const nome of [`${id}.webp`, `${id}-mini.webp`]) fs.writeFileSync(path.join(pasta, 'imagens', nome), imagem);
    banco.prepare(`INSERT INTO midias (id, nome, arquivo, miniatura, alternativo, pasta, largura, altura, bytes)
      VALUES (?, 'Imagem de teste', ?, ?, 'Teste', '', 20, 20, ?)`)
      .run(id, `${id}.webp`, `${id}-mini.webp`, imagem.length);
    fs.writeFileSync(path.join(pasta, 'servidor.pid'), String(process.pid));
    const cliente = await acesso.entrar('conta1@example.test', senha);
    acesso.gerarRecuperacao(1, null, 'cliente');
    assert.equal(agendamento.configuracao().intervalo, 24);
    const primeira = agendamento.executarSeNecessario();
    assert(primeira.automatico);
    assert.equal(agendamento.executarSeNecessario(), null);
    const snapshot = new DatabaseSync(path.join(agendamento.pastaBackups, primeira.id, 'banco.sqlite'), { readOnly: true });
    assert.equal(snapshot.prepare('SELECT COUNT(*) n FROM sessoes').get().n, 0);
    assert.equal(snapshot.prepare('SELECT COUNT(*) n FROM recuperacoes').get().n, 0);
    snapshot.close();
    assert(banco.prepare('SELECT COUNT(*) n FROM sessoes').get().n > 0);
    assert(cliente.token);
    const manual = agendamento.criar();
    assert.equal(manual.ambiente, true);
    agendamento.configurar({ ativo: true, intervalo: 24, manter: 2 });
    for (let i = 0; i < 3; i++) agendamento.executarSeNecessario(Date.now() + 25 * 3600000);
    assert.equal(agendamento.listar().filter(item => item.automatico).length, 2);
    assert(agendamento.listar().some(item => item.id === manual.id));
    const baixar = agendamento.baixar(manual.id);
    const extraida = path.join(pasta, 'extraida');
    pacotes.extrairBackup(baixar, extraida);
    assert.match(fs.readFileSync(path.join(extraida, 'ambiente.env'), 'utf8'), /segredo-apenas-teste/);
    fs.appendFileSync(path.join(extraida, `imagens/${id}.webp`), 'alterada');
    assert.throws(() => backup.validarBackup(extraida), /alterado/);
    assert.throws(() => agendamento.baixar('../.env'));

    const ausente = path.join(pasta, 'imagens', `${id}.webp`);
    fs.renameSync(ausente, ausente + '.guardada');
    assert.throws(() => agendamento.executarSeNecessario(Date.now() + 25 * 3600000));
    assert.match(agendamento.configuracao().erro, /Falha/);
    fs.renameSync(ausente + '.guardada', ausente);
    agendamento.executarSeNecessario(Date.now() + 25 * 3600000);
    assert.equal(agendamento.configuracao().erro, null);
    agendamento.configurar({ ativo: false, intervalo: 24, manter: 2 });
    assert.equal(agendamento.executarSeNecessario(Date.now() + 25 * 3600000), null);

    const proibida = path.join(pasta, 'proibida');
    fs.mkdirSync(proibida);
    fs.writeFileSync(path.join(proibida, 'segredo.txt'), 'nao extrair');
    const pacoteInvalido = path.join(pasta, 'invalido.tar.gz');
    tar.c({ cwd: proibida, file: pacoteInvalido, gzip: true, sync: true }, ['segredo.txt']);
    assert.throws(() => pacotes.extrairBackup(pacoteInvalido, path.join(pasta, 'extracao-proibida')), /inválido/);
    const comandoBloqueado = spawnSync(process.execPath, ['scripts/backup.cjs', path.join(pasta, 'bloqueado')],
      { env: process.env, encoding: 'utf8' });
    assert.equal(comandoBloqueado.status, 1);

    servidor = require('../backend/aplicacao.cjs').listen(0, '127.0.0.1');
    await once(servidor, 'listening');
    const base = `http://127.0.0.1:${servidor.address().port}`;
    const criador = await acesso.entrar('conta2@example.test', senha);
    require('./apoio.cjs').liberarPainelTeste(pasta, criador.token);
    function chamar(rota, method = 'GET', sessao, body, csrf = sessao?.csrf) {
      return fetch(base + '/api/admin/backups' + rota, { method,
        headers: { ...(sessao ? { Cookie: acesso.cookie(sessao.token, false).split(';')[0], 'X-CSRF-Token': csrf } : {}),
          'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
      });
    }
    assert.equal((await chamar('')).status, 401);
    for (const conta of [1, 3, 4]) {
      const sessao = await acesso.entrar(`conta${conta}@example.test`, senha);
      require('./apoio.cjs').liberarPainelTeste(pasta, sessao.token);
      assert.equal((await chamar('', 'GET', sessao)).status, 403);
    }
    assert.equal((await chamar('', 'POST', criador, {}, 'errado')).status, 403);
    assert.equal((await chamar('/configuracao', 'PUT', criador, { ativo: true, intervalo: 24, manter: 100 })).status, 400);
    const lista = await (await chamar('', 'GET', criador)).json();
    assert.equal(lista.externo.ativo, false);
    assert.equal(lista.externo.configurado, false);
    assert.equal((await chamar('/externos', 'POST', criador, {})).status, 409);
    assert(!JSON.stringify(lista).includes('segredo-apenas-teste'));
    const criada = await chamar('', 'POST', criador, {});
    assert.equal(criada.status, 201);
    const item = await criada.json();
    assert.equal((await chamar(`/${item.id}/verificar`, 'POST', criador, {})).status, 200);
    const download = await chamar(`/${item.id}/baixar`, 'GET', criador);
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-disposition'), /attachment/);
    assert((await download.arrayBuffer()).byteLength > 0);

    const restaurada = path.join(pasta, 'restaurada');
    fs.mkdirSync(restaurada);
    const executar = spawnSync(process.execPath, ['scripts/restaurar.cjs', baixar, '--confirmar', '--restaurar-ambiente'],
      { env: { ...process.env, PASTA_DADOS: restaurada, PASTA_BACKUPS: path.join(restaurada, 'backups'),
        ARQUIVO_AMBIENTE: path.join(restaurada, '.env') }, encoding: 'utf8' });
    assert.equal(executar.status, 0, executar.stderr);
    const db = new DatabaseSync(path.join(restaurada, 'peregrina.sqlite'), { readOnly: true });
    assert.equal(db.prepare('SELECT COUNT(*) n FROM usuarios').get().n, 4);
    assert.equal(db.prepare('SELECT senha_hash FROM usuarios WHERE id = 2').get().senha_hash, hash);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM sessoes').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM recuperacoes_codigos').get().n, 0);
    db.close();
    assert(fs.existsSync(path.join(restaurada, 'imagens', `${id}.webp`)));
    assert.match(fs.readFileSync(path.join(restaurada, '.env'), 'utf8'), /segredo-apenas-teste/);
    assert(fs.readdirSync(path.join(restaurada, 'backups')).some(nome => nome.startsWith('antes-restauracao-')));
  } finally {
    if (servidor) await new Promise(resolver => servidor.close(resolver));
    banco.close();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
