const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const codigo = fs.readFileSync(path.join(__dirname, '../frontend/js/tema.js'), 'utf8');

function navegador(valores = new Map(), bloqueado = false) {
  const eventos = {};
  const raiz = { dataset: {} };
  const estado = {};
  let foco;
  const opcoes = ['claro', 'escuro'].map((tema) => ({
    dataset: { definirTema: tema }, atributos: {}, eventos: {},
    setAttribute(nome, valor) { this.atributos[nome] = valor; },
    addEventListener(nome, acao) { this.eventos[nome] = acao; },
    focus() { foco = tema; },
  }));
  const document = {
    documentElement: raiz,
    querySelectorAll: () => opcoes,
    querySelector: (seletor) => seletor === '#estado-tema' ? estado : null,
    addEventListener: (nome, acao) => { eventos[nome] = acao; },
  };
  const localStorage = {
    getItem(chave) { if (bloqueado) throw Error(); return valores.get(chave) || null; },
    setItem(chave, valor) { if (bloqueado) throw Error(); valores.set(chave, valor); },
  };
  vm.runInNewContext(codigo, { document, localStorage,
    window: { addEventListener: (nome, acao) => { eventos[nome] = acao; } } });
  eventos.DOMContentLoaded();
  return { raiz, opcoes, estado, eventos, foco: () => foco };
}

test('escolha direta de tema persiste, restaura e sincroniza com outra aba', () => {
  const valores = new Map([['peregrina-tema-conta', 'escuro']]);
  const pagina = navegador(valores);
  assert.equal(pagina.raiz.dataset.tema, 'escuro');
  pagina.opcoes[0].eventos.click();
  pagina.opcoes[0].eventos.click();
  assert.equal(pagina.raiz.dataset.tema, 'claro');
  assert.equal(pagina.opcoes[0].atributos['aria-pressed'], 'true');
  assert.equal(pagina.opcoes[1].atributos['aria-pressed'], 'false');
  assert.equal(navegador(valores).raiz.dataset.tema, 'claro');
  valores.set('peregrina-tema', 'escuro');
  pagina.eventos.storage({ key: 'peregrina-tema' });
  assert.equal(pagina.raiz.dataset.tema, 'escuro');
});

test('tema permite teclado e continua funcionando sem armazenamento disponível', () => {
  const pagina = navegador(new Map(), true);
  for (const [origem, tecla, esperado] of [[0, 'ArrowRight', 'escuro'], [1, 'Home', 'claro'],
    [0, 'End', 'escuro'], [1, 'ArrowLeft', 'claro']]) {
    let prevenido = false;
    pagina.opcoes[origem].eventos.keydown({ key: tecla, preventDefault() { prevenido = true; } });
    assert.equal(prevenido, true);
    assert.equal(pagina.raiz.dataset.tema, esperado);
    assert.equal(pagina.foco(), esperado);
  }
  assert.match(pagina.estado.textContent, /Não foi possível salvar/);
});
