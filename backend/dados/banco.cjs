const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const padroes = require('./padroes.cjs');

const pastaDados = path.resolve(process.env.PASTA_DADOS || path.join(__dirname, '../../dados'));
const pastaPublica = path.resolve(__dirname, '../../frontend');
if (pastaDados === pastaPublica || pastaDados.startsWith(pastaPublica + path.sep)) {
  throw new Error('A pasta de dados precisa ficar fora da pasta pública frontend.');
}
fs.mkdirSync(path.join(pastaDados, 'imagens'), { recursive: true });

const banco = new DatabaseSync(path.join(pastaDados, 'peregrina.sqlite'));
banco.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
banco.exec('CREATE TABLE IF NOT EXISTS migracoes (nome TEXT PRIMARY KEY, aplicado_em TEXT DEFAULT CURRENT_TIMESTAMP)');

function transacao(acao) {
  banco.exec('BEGIN IMMEDIATE');
  try {
    const resultado = acao();
    banco.exec('COMMIT');
    return resultado;
  } catch (erro) {
    banco.exec('ROLLBACK');
    throw erro;
  }
}

const pastaMigracoes = path.resolve(__dirname, '../../banco-de-dados/migracoes');
for (const nome of fs.readdirSync(pastaMigracoes).filter((item) => item.endsWith('.sql')).sort()) {
  if (banco.prepare('SELECT 1 FROM migracoes WHERE nome = ?').get(nome)) continue;
  transacao(() => {
    banco.exec(fs.readFileSync(path.join(pastaMigracoes, nome), 'utf8'));
    banco.prepare('INSERT INTO migracoes (nome) VALUES (?)').run(nome);
  });
}

transacao(() => {
  if (banco.prepare('SELECT COUNT(*) AS total FROM categorias').get().total === 0) {
    padroes.categorias.forEach(([nome, slug], posicao) => {
      banco.prepare('INSERT INTO categorias (nome, slug, posicao) VALUES (?, ?, ?)')
        .run(nome, slug, posicao);
    });
  }
  banco.prepare('INSERT OR IGNORE INTO configuracoes (id, dados) VALUES (1, ?)')
    .run(JSON.stringify(padroes.configuracoes));
  const conteudo = JSON.stringify(padroes.secoes);
  banco.prepare('INSERT OR IGNORE INTO conteudos (id, rascunho, publicado) VALUES (1, ?, ?)')
    .run(conteudo, conteudo);
});

function registrar(usuario, acao, entidade, registro) {
  banco.prepare(`
    INSERT INTO historico (usuario_id, autor, acao, entidade, registro)
    VALUES (?, ?, ?, ?, ?)
  `).run(usuario?.id || null, usuario?.nome || 'Manutenção local', acao, entidade, String(registro));
}

module.exports = { banco, pastaDados, transacao, registrar };
