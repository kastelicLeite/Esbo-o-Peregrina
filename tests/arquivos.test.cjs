const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const raiz = path.resolve(__dirname, '..');

function arquivos(pasta) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = path.join(pasta, item.name);
    return item.isDirectory() ? arquivos(caminho) : [caminho];
  });
}

test('módulos do frontend possuem sintaxe válida e importações existentes', () => {
  for (const arquivo of arquivos(path.join(raiz, 'frontend/js')).filter((item) => item.endsWith('.js'))) {
    const fonte = fs.readFileSync(arquivo, 'utf8');
    const verificacao = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: fonte, encoding: 'utf8',
    });
    assert.equal(verificacao.status, 0, `${arquivo}: ${verificacao.stderr}`);
    for (const referencia of fonte.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      assert.ok(fs.existsSync(path.resolve(path.dirname(arquivo), referencia[1])), `${arquivo}: ${referencia[1]}`);
    }
  }
});

test('referências estáticas das páginas existem e não há senha provisória no frontend', () => {
  const frontend = path.join(raiz, 'frontend');
  for (const arquivo of arquivos(frontend)) {
    if (arquivo.endsWith('.js') || arquivo.endsWith('.html')) {
      const fonte = fs.readFileSync(arquivo, 'utf8');
      assert.ok(!fonte.includes('PeregrinaAdmin'), arquivo);
      if (!arquivo.endsWith('.html')) continue;
      const base = fonte.includes('<base href="/">') ? frontend : path.dirname(arquivo);
      for (const referencia of fonte.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const endereco = referencia[1];
        if (!endereco || endereco.startsWith('#') || endereco.startsWith('/') || /^https?:/.test(endereco)) continue;
        assert.ok(fs.existsSync(path.resolve(base, endereco)), `${arquivo}: ${endereco}`);
      }
    }
  }
});
