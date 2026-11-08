const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.resolve(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

test('páginas têm idioma, título, atalho funcional, rótulos e alternativas de imagens', () => {
  const arquivos = fs.readdirSync(path.join(raiz, 'frontend/paginas')).filter((nome) => nome.endsWith('.html'))
    .map((nome) => `frontend/paginas/${nome}`);
  arquivos.push('backend/visualizador/banco-de-dados.html');
  for (const arquivo of arquivos) {
    const html = ler(arquivo);
    assert.match(html, /<html\b[^>]*lang="pt-BR"/, arquivo);
    assert.match(html, /<title>[^<]+<\/title>/, arquivo);
    const main = html.match(/<main\b[^>]*>/)?.[0];
    assert.ok(main, arquivo);
    const id = main.match(/\bid="([^"]+)"/)?.[1];
    assert.ok(id && html.includes(`href="#${id}"`), arquivo);
    assert.match(main, /tabindex="-1"/, arquivo);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((item) => item[1]);
    assert.equal(new Set(ids).size, ids.length, `IDs repetidos: ${arquivo}`);
    for (const imagem of html.matchAll(/<img\b[^>]*>/g)) assert.match(imagem[0], /\balt="[^"]*"/, arquivo);
    for (const controle of html.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
      const tag = controle[0];
      if (/type="hidden"|aria-label(?:ledby)?=/.test(tag)) continue;
      const campo = tag.match(/\bid="([^"]+)"/)?.[1];
      const antes = html.slice(0, controle.index);
      const envolvido = antes.lastIndexOf('<label') > antes.lastIndexOf('</label>');
      assert.ok(envolvido || (campo && html.includes(`for="${campo}"`)), `${arquivo}: ${tag}`);
    }
    for (const atributo of html.matchAll(/\baria-(?:describedby|labelledby|controls)="([^"]+)"/g)) {
      for (const destino of atributo[1].split(/\s+/)) {
        // O painel de sugestões é criado pelo módulo de busca.
        if (destino === 'sugestoes-cabecalho') continue;
        assert.ok(ids.includes(destino), `${arquivo}: ${destino}`);
      }
    }
  }
});

test('cores de texto e bordas dos campos têm contraste nos dois temas', () => {
  function variaveis(texto) {
    return Object.fromEntries([...texto.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((item) => [item[1], item[2]]));
  }
  const claro = variaveis(ler('frontend/css/base/variaveis.css'));
  const escuro = { ...claro, ...variaveis(ler('frontend/css/base/tema.css').split('color-scheme: dark;')[1].split('}')[0]) };
  function luminancia(hex) {
    return hex.slice(1).match(/../g).map((valor) => parseInt(valor, 16) / 255)
      .map((valor) => valor <= .04045 ? valor / 12.92 : ((valor + .055) / 1.055) ** 2.4)
      .reduce((soma, valor, indice) => soma + valor * [.2126, .7152, .0722][indice], 0);
  }
  for (const cores of [claro, escuro]) {
    for (const [frente, fundo, minimo] of [['tinta', 'papel', 4.5], ['cinza', 'papel', 4.5],
      ['ciano-texto', 'ciano-suave', 4.5], ['magenta-texto', 'magenta-suave', 4.5], ['borda-controle', 'papel', 3]]) {
      const valores = [luminancia(cores[frente]), luminancia(cores[fundo])].sort((a, b) => b - a);
      assert.ok((valores[0] + .05) / (valores[1] + .05) >= minimo, `${frente}/${fundo}`);
    }
  }
});

function prepararGaleria(reduzido = false) {
  class Elemento {
    constructor(tag) {
      this.tag = tag; this.filhos = []; this.eventos = {}; this.atributos = {};
      this.isConnected = true; this.offsetLeft = 0; this.offsetWidth = 64; this.clientWidth = 300; this.scrollLeft = 0;
    }
    append(...filhos) { this.filhos.push(...filhos); }
    setAttribute(chave, valor) { this.atributos[chave] = valor; }
    addEventListener(nome, acao) { this.eventos[nome] = acao; }
    contains(alvo) { return this === alvo || this.filhos.some((filho) => filho.contains?.(alvo)); }
  }
  let agora = 0;
  let temporizador;
  let interrompido = false;
  const preferencia = { matches: reduzido, addEventListener(_nome, acao) { this.acao = acao; },
    removeEventListener(_nome, acao) { assert.equal(this.acao, acao); this.acao = null; } };
  const document = { createElement: (tag) => new Elemento(tag), hidden: false, activeElement: null };
  const contexto = vm.createContext({ document, window: { matchMedia: () => preferencia }, Date: { now: () => agora },
    setInterval: (acao) => { temporizador = acao; return 1; }, clearInterval: () => { interrompido = true; } });
  vm.runInContext(ler('frontend/js/galeria-produto.js').replace('export function', 'function'), contexto);
  const destino = new Elemento('div');
  const limpar = contexto.montarGaleria(destino, [
    { url: '/primeira.webp', miniatura: '/mini1.webp', alternativo: 'Sacola kraft com alça de cordão' },
    { url: '/segunda.webp', miniatura: '/mini2.webp', alternativo: '' },
  ]);
  const foto = destino.filhos[0].filhos[0];
  const pausa = destino.filhos[2].filhos[1];
  return { destino, foto, pausa, document, preferencia, limpar, interrompido: () => interrompido,
    avancar: () => { agora += 9000; temporizador(); } };
}

test('galeria permite pausar, usar setas e não avança durante foco de teclado', () => {
  const galeria = prepararGaleria();
  galeria.avancar();
  assert.equal(galeria.foto.src, '/segunda.webp');
  assert.equal(galeria.foto.alt, 'Imagem 2 do produto');
  galeria.pausa.eventos.click();
  galeria.avancar();
  assert.equal(galeria.foto.src, '/segunda.webp');
  assert.equal(galeria.pausa.textContent, 'Retomar troca de fotos');
  let prevenido = false;
  galeria.destino.eventos.keydown({ key: 'ArrowLeft', preventDefault: () => { prevenido = true; } });
  assert.equal(prevenido, true);
  assert.equal(galeria.foto.src, '/primeira.webp');
  galeria.pausa.eventos.click();
  galeria.document.activeElement = galeria.pausa;
  galeria.avancar();
  assert.equal(galeria.foto.src, '/primeira.webp');
  galeria.limpar();
  assert.equal(galeria.interrompido(), true);
  assert.equal(galeria.preferencia.acao, null);
});

test('preferência de movimento reduzido inicia galeria pausada', () => {
  const galeria = prepararGaleria(true);
  galeria.avancar();
  assert.equal(galeria.foto.src, '/primeira.webp');
  assert.equal(galeria.pausa.textContent, 'Retomar troca de fotos');
  galeria.limpar();
});
