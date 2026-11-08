const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');

function executar(arquivo, argumentos, pasta, entrada) {
  const resultado = spawnSync(process.execPath, [arquivo, ...argumentos], {
    cwd: raiz,
    env: { ...process.env, PASTA_DADOS: pasta, PASTA_BACKUPS: path.join(pasta, 'backups') },
    input: entrada ? JSON.stringify(entrada) : undefined,
    encoding: 'utf8',
  });
  if (resultado.status !== 0) throw new Error(resultado.stderr || resultado.stdout || 'Falha no comando de teste.');
  return resultado.stdout;
}

async function iniciarServidor(pasta) {
  const processo = spawn(process.execPath, ['scripts/servidor.cjs'], {
    cwd: raiz,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', PASTA_DADOS: pasta, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let erros = '';
  processo.stderr.on('data', (dado) => { erros += dado; });
  const endereco = await new Promise((resolver, rejeitar) => {
    const limite = setTimeout(() => {
      processo.kill();
      rejeitar(new Error(`Tempo excedido ao iniciar o servidor: ${erros}`));
    }, 15000);
    processo.stdout.on('data', (dados) => {
      const resultado = dados.toString().match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (resultado) { clearTimeout(limite); resolver(`http://127.0.0.1:${resultado[1]}`); }
    });
    processo.once('exit', (codigo) => {
      clearTimeout(limite);
      rejeitar(new Error(`Servidor encerrado (${codigo}): ${erros}`));
    });
  });
  return {
    endereco,
    async encerrar() {
      if (processo.exitCode !== null || processo.signalCode !== null) return;
      const concluido = once(processo, 'exit');
      processo.kill();
      await concluido;
    },
  };
}

function liberarPainelTeste(pasta, token) {
  const { DatabaseSync } = require('node:sqlite');
  const { createHash } = require('node:crypto');
  const banco = new DatabaseSync(path.join(pasta, 'peregrina.sqlite'));
  try {
    banco.prepare('INSERT OR REPLACE INTO acessos_painel VALUES (?, ?)')
      .run(createHash('sha256').update(token).digest('hex'), Date.now() + 7200000);
    banco.prepare('INSERT OR REPLACE INTO acessos_tabelas VALUES (?, ?)')
      .run(createHash('sha256').update(token).digest('hex'), Date.now() + 900000);
  } finally { banco.close(); }
}

module.exports = { executar, iniciarServidor, liberarPainelTeste };
