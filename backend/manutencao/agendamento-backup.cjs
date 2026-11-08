const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pastaDados, banco } = require('../dados/banco.cjs');
const { criarBackup, validarBackup } = require('./backup.cjs');
const { compactarBackup } = require('./pacote-backup.cjs');
const externo = require('./backup-externo.cjs');
let enviandoExterno = false;
let copiaEmEnvio;

const pastaBackups = path.resolve(process.env.PASTA_BACKUPS || path.join(pastaDados, 'backups'));
const pastaPublica = path.resolve(__dirname, '../../frontend');
if (pastaBackups === pastaPublica || pastaBackups.startsWith(pastaPublica + path.sep)) {
  throw new Error('A pasta de backups precisa ficar fora da pasta pública.');
}
const arquivoEstado = path.join(pastaBackups, 'agendamento.json');
const idValido = id => /^(manual|automatico)-\d{13}-[a-f0-9-]{36}$/.test(id);

function configuracao() {
  if (!fs.existsSync(arquivoEstado)) return { ativo: true, intervalo: 24, manter: 7, ultimo: null, erro: null };
  const dados = JSON.parse(fs.readFileSync(arquivoEstado, 'utf8'));
  if (typeof dados.ativo !== 'boolean' || ![6, 12, 24].includes(dados.intervalo)
    || !Number.isInteger(dados.manter) || dados.manter < 1 || dados.manter > 30) throw new Error('Configuração de backup inválida.');
  return dados;
}

function salvarEstado(dados) {
  fs.mkdirSync(pastaBackups, { recursive: true });
  const temporario = arquivoEstado + '.novo';
  fs.writeFileSync(temporario, JSON.stringify(dados, null, 2));
  fs.renameSync(temporario, arquivoEstado);
}

function configurar(dados) {
  const anterior = configuracao();
  const nova = { ...anterior, ativo: dados.ativo, intervalo: Number(dados.intervalo), manter: Number(dados.manter) };
  if (typeof nova.ativo !== 'boolean' || ![6, 12, 24].includes(nova.intervalo)
    || !Number.isInteger(nova.manter) || nova.manter < 1 || nova.manter > 30) throw new Error('Confira o intervalo e a retenção.');
  salvarEstado(nova);
  return nova;
}

function localizar(id) {
  if (!idValido(id)) throw new Error('Backup não encontrado.');
  const pasta = path.resolve(pastaBackups, id);
  if (path.dirname(pasta) !== pastaBackups || !fs.existsSync(pasta) || fs.lstatSync(pasta).isSymbolicLink()) {
    throw new Error('Backup não encontrado.');
  }
  return pasta;
}

function listar() {
  if (!fs.existsSync(pastaBackups)) return [];
  return fs.readdirSync(pastaBackups).filter(idValido).map(id => {
    try {
      const pasta = localizar(id);
      const manifesto = JSON.parse(fs.readFileSync(path.join(pasta, 'manifesto.json'), 'utf8'));
      const pacote = path.join(pasta, 'backup.tar.gz');
      return { id, criado_em: manifesto.criado_em, automatico: id.startsWith('automatico-'),
        totais: manifesto.totais, bytes: fs.existsSync(pacote) ? fs.statSync(pacote).size : 0,
        ambiente: manifesto.arquivos.some(item => item.nome === 'ambiente.env'), externo: externo.estado(pasta) };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

function removerAntigos(manter) {
  for (const copia of listar().filter(item => item.automatico).slice(manter)) {
    if (copia.id === copiaEmEnvio) continue;
    const pasta = localizar(copia.id);
    if (path.dirname(pasta) !== pastaBackups || !copia.id.startsWith('automatico-')) throw new Error('Pasta de retenção inválida.');
    fs.rmSync(pasta, { recursive: true, force: true });
  }
}

function criar(automatico = false) {
  const id = `${automatico ? 'automatico' : 'manual'}-${Date.now()}-${randomUUID()}`;
  const pasta = path.join(pastaBackups, id);
  fs.mkdirSync(pastaBackups, { recursive: true });
  try {
    criarBackup(pasta, { emUso: true });
    compactarBackup(pasta, path.join(pasta, 'backup.tar.gz'));
    if (automatico) {
      const config = configuracao();
      salvarEstado({ ...config, ultimo: new Date().toISOString(), erro: null });
      removerAntigos(config.manter);
    }
    queueMicrotask(() => { void enviarPendentes(); });
    return listar().find(item => item.id === id);
  } catch (erro) {
    if (path.dirname(path.resolve(pasta)) === pastaBackups && idValido(id)) {
      fs.rmSync(pasta, { recursive: true, force: true });
    }
    throw erro;
  }
}

function verificar(id) {
  validarBackup(localizar(id));
  return { mensagem: 'Banco, imagens e arquivos conferidos. Backup íntegro.' };
}

function baixar(id) {
  const pasta = localizar(id);
  validarBackup(pasta);
  const pacote = path.join(pasta, 'backup.tar.gz');
  if (!fs.existsSync(pacote)) compactarBackup(pasta, pacote);
  return pacote;
}

function executarSeNecessario(agora = Date.now()) {
  const config = configuracao();
  if (!config.ativo || (config.ultimo && agora - Date.parse(config.ultimo) < config.intervalo * 3600000)) return null;
  try { return criar(true); }
  catch (erro) {
    salvarEstado({ ...config, erro: 'Falha ao criar o backup. Confira espaço livre e permissões da pasta.' });
    throw erro;
  }
}

function iniciarAgendamento() {
  function executar() {
    banco.prepare('DELETE FROM historico_clientes WHERE criado_em < ?').run(Date.now() - 90 * 86400000);
    try { executarSeNecessario(); }
    catch { console.error('Falha no backup automático. Consulte Histórico e manutenção no painel.'); }
  }
  const inicio = setTimeout(executar, 5000);
  const intervalo = setInterval(executar, 3600000);
  const intervaloExterno = setInterval(() => { void enviarPendentes(); }, 10 * 60000);
  inicio.unref();
  intervalo.unref();
  intervaloExterno.unref();
  return () => { clearTimeout(inicio); clearInterval(intervalo); clearInterval(intervaloExterno); };
}

async function enviarPendentes() {
  if (enviandoExterno) return { ocupado: true, enviados: 0 };
  if (!externo.disponibilidade().configurado) return { ocupado: false, enviados: 0 };
  enviandoExterno = true;
  let enviados = 0;
  try {
    for (const copia of listar().filter(item => item.externo.status !== 'enviado').slice(0, 3)) {
      copiaEmEnvio = copia.id;
      await externo.enviar({ id: copia.id, arquivo: baixar(copia.id), pasta: localizar(copia.id) });
      enviados++;
    }
    return { ocupado: false, enviados };
  } catch {
    console.error('Falha no backup externo. A cópia local foi preservada.');
    return { ocupado: false, enviados, falha: true };
  } finally { enviandoExterno = false; copiaEmEnvio = null; }
}

module.exports = { pastaBackups, configuracao, configurar, listar, criar, verificar, baixar,
  executarSeNecessario, iniciarAgendamento, enviarPendentes };
