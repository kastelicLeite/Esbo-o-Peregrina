const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { parseEnv } = require('node:util');
const { banco, pastaDados } = require('../dados/banco.cjs');

const resumo = (arquivo) => createHash('sha256').update(fs.readFileSync(arquivo)).digest('hex');

function copiarAmbiente(destino) {
  const padrao = path.resolve(__dirname, '../../dados');
  const arquivo = process.env.ARQUIVO_AMBIENTE
    || (pastaDados === padrao ? path.resolve(__dirname, '../../.env') : null);
  const valores = arquivo && fs.existsSync(arquivo) ? parseEnv(fs.readFileSync(arquivo, 'utf8')) : {};
  for (const chave of ['GMAIL_USUARIO', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN',
    'RESEND_API_KEY', 'EMAIL_REMETENTE', 'EMAIL_CONTATO']) {
    if (process.env[chave]) valores[chave] = process.env[chave];
  }
  if (!Object.keys(valores).length) return false;
  const conteudo = Object.entries(valores).map(([chave, valor]) => `${chave}=${JSON.stringify(valor)}`).join('\n');
  fs.writeFileSync(path.join(destino, 'ambiente.env'), conteudo + '\n', { mode: 0o600 });
  return true;
}

function exigirServidorParado(permitirAtual = false) {
  const trava = path.join(pastaDados, 'servidor.pid');
  if (!fs.existsSync(trava)) return;
  const pid = Number(fs.readFileSync(trava, 'utf8'));
  if (permitirAtual && pid === process.pid) return;
  let ativo = false;
  try { process.kill(pid, 0); ativo = true; } catch {}
  if (ativo) throw new Error('Encerre o servidor antes de criar ou restaurar um backup.');
}

function criarBackup(destino, opcoes = {}) {
  exigirServidorParado(opcoes.emUso === true);
  destino = path.resolve(destino);
  if (fs.existsSync(destino)) throw new Error('Escolha uma pasta nova para o backup.');
  fs.mkdirSync(path.join(destino, 'imagens'), { recursive: true, mode: 0o700 });
  const arquivoBanco = path.join(destino, 'banco.sqlite');
  banco.prepare('VACUUM INTO ?').run(arquivoBanco);
  fs.chmodSync(arquivoBanco, 0o600);
  const copia = new DatabaseSync(arquivoBanco);
  let imagens;
  let totais;
  try {
    copia.exec('DELETE FROM sessoes; DELETE FROM recuperacoes;');
    if (copia.prepare("SELECT 1 FROM sqlite_master WHERE name = 'acessos_tabelas'").get()) {
      copia.exec('DELETE FROM acessos_tabelas;');
    }
    if (copia.prepare("SELECT 1 FROM sqlite_master WHERE name = 'acessos_painel'").get()) {
      copia.exec('DELETE FROM acessos_painel;');
    }
    if (copia.prepare("SELECT 1 FROM sqlite_master WHERE name = 'recuperacoes_codigos'").get()) {
      copia.exec('DELETE FROM recuperacoes_codigos;');
    }
    imagens = copia.prepare('SELECT arquivo, miniatura FROM midias').all();
    totais = Object.fromEntries(['produtos', 'usuarios', 'midias'].map(tabela =>
      [tabela, copia.prepare(`SELECT COUNT(*) AS total FROM ${tabela}`).get().total]));
  } finally { copia.close(); }
  const arquivos = ['banco.sqlite'];
  for (const item of imagens) {
    for (const nome of [item.arquivo, item.miniatura]) {
      if (!/^[a-f0-9-]+(?:-mini)?\.webp$/.test(nome)) throw new Error('Nome de imagem inválido.');
      const relativo = `imagens/${nome}`;
      fs.copyFileSync(path.join(pastaDados, relativo), path.join(destino, relativo));
      arquivos.push(relativo);
    }
  }
  if (opcoes.ambiente !== false && copiarAmbiente(destino)) {
    arquivos.push('ambiente.env');
  }
  const manifesto = {
    versao: 2,
    criado_em: new Date().toISOString(),
    totais,
    arquivos: arquivos.map((nome) => ({ nome, sha256: resumo(path.join(destino, nome)) })),
  };
  fs.writeFileSync(path.join(destino, 'manifesto.json'), JSON.stringify(manifesto, null, 2));
  validarBackup(destino);
  return destino;
}

function validarBackup(origem) {
  origem = path.resolve(origem);
  const manifesto = JSON.parse(fs.readFileSync(path.join(origem, 'manifesto.json'), 'utf8'));
  if (![1, 2].includes(manifesto.versao) || !Array.isArray(manifesto.arquivos)) throw new Error('Manifesto inválido.');
  const encontrados = new Set();
  for (const item of manifesto.arquivos) {
    if (typeof item.nome !== 'string' || encontrados.has(item.nome) || !/^[a-f0-9]{64}$/.test(item.sha256)
      || (item.nome !== 'banco.sqlite' && !(manifesto.versao === 2 && item.nome === 'ambiente.env')
        && !/^imagens\/[a-f0-9-]+(?:-mini)?\.webp$/.test(item.nome))) {
      throw new Error('O backup contém um caminho não permitido.');
    }
    encontrados.add(item.nome);
    const arquivo = path.join(origem, item.nome);
    if (!fs.lstatSync(arquivo).isFile() || fs.lstatSync(arquivo).isSymbolicLink()
      || !fs.realpathSync(arquivo).startsWith(fs.realpathSync(origem) + path.sep)
      || resumo(arquivo) !== item.sha256) throw new Error('Um arquivo do backup está ausente ou foi alterado.');
  }
  if (!manifesto.arquivos.some((item) => item.nome === 'banco.sqlite')) throw new Error('Banco ausente.');
  const copia = new DatabaseSync(path.join(origem, 'banco.sqlite'), { readOnly: true });
  try {
    const integridade = copia.prepare('PRAGMA integrity_check').get();
    if (Object.values(integridade)[0] !== 'ok') throw new Error('O banco do backup não passou na verificação.');
    if (copia.prepare('PRAGMA foreign_key_check').all().length) throw new Error('O banco contém vínculos inválidos.');
    const nomes = new Set(manifesto.arquivos.map((item) => item.nome));
    for (const item of copia.prepare('SELECT arquivo, miniatura FROM midias').all()) {
      if (![item.arquivo, item.miniatura].every((nome) => nomes.has(`imagens/${nome}`))) {
        throw new Error('O backup não inclui todas as imagens do banco.');
      }
    }
  } finally { copia.close(); }
  return manifesto;
}

function restaurarBackup(origem, opcoes = {}) {
  exigirServidorParado();
  origem = path.resolve(origem);
  const manifesto = validarBackup(origem);
  const seguranca = path.resolve(process.env.PASTA_BACKUPS || path.join(pastaDados, 'backups'),
    `antes-restauracao-${Date.now()}`);
  criarBackup(seguranca);
  const ambiente = process.env.ARQUIVO_AMBIENTE || path.resolve(__dirname, '../../.env');
  for (const item of manifesto.arquivos.filter((registro) => registro.nome.startsWith('imagens/'))) {
    fs.copyFileSync(path.join(origem, item.nome), path.join(pastaDados, item.nome));
  }
  banco.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  banco.close();
  const destino = path.join(pastaDados, 'peregrina.sqlite');
  fs.copyFileSync(path.join(origem, 'banco.sqlite'), destino);
  const restaurado = new DatabaseSync(destino);
  try {
    restaurado.exec('DELETE FROM sessoes; DELETE FROM recuperacoes;');
    if (restaurado.prepare("SELECT 1 FROM sqlite_master WHERE name = 'acessos_tabelas'").get()) {
      restaurado.exec('DELETE FROM acessos_tabelas;');
    }
    if (restaurado.prepare("SELECT 1 FROM sqlite_master WHERE name = 'acessos_painel'").get()) {
      restaurado.exec('DELETE FROM acessos_painel;');
    }
    if (restaurado.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'recuperacoes_codigos'").get()) {
      restaurado.exec('DELETE FROM recuperacoes_codigos;');
    }
    restaurado.prepare(`INSERT INTO historico (autor, acao, entidade, registro)
      VALUES ('Manutenção local', 'Restaurou backup verificado', 'manutencao', 'restauracao')`).run();
  } finally { restaurado.close(); }
  if (opcoes.ambiente && manifesto.arquivos.some(item => item.nome === 'ambiente.env')) {
    fs.copyFileSync(path.join(origem, 'ambiente.env'), ambiente);
  }
  return seguranca;
}

module.exports = { criarBackup, restaurarBackup, validarBackup, exigirServidorParado };
