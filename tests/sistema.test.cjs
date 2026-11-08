const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { DatabaseSync } = require('node:sqlite');
const { executar, iniciarServidor, liberarPainelTeste } = require('./apoio.cjs');

test('painel e catálogo integrados com dados persistentes', async (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'peregrina-sistema-'));
  let servidor;
  let admin;
  let editor;
  let produto;
  let midia;
  let categoria;
  let editorId;
  let dadosBase;

  const dadosLogin = { nome: 'Administrador de teste', email: 'admin@example.test', senha: 'SenhaDeTeste12345!' };

  async function chamar(url, method = 'GET', body, acesso, headers = {}) {
    const resposta = await fetch(`${servidor.endereco}${url}`, {
      method,
      headers: {
        ...(acesso ? { Cookie: acesso.cookie, 'X-CSRF-Token': acesso.csrf } : {}),
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const texto = await resposta.text();
    let dados;
    try { dados = JSON.parse(texto); } catch { dados = texto; }
    return { status: resposta.status, dados, headers: resposta.headers };
  }

  async function login(email, senha) {
    const resposta = await chamar('/api/acesso/entrar', 'POST', { email, senha });
    assert.equal(resposta.status, 200, JSON.stringify(resposta.dados));
    liberarPainelTeste(pasta, resposta.headers.get('set-cookie').split(';')[0].split('=')[1]);
    return {
      cookie: resposta.headers.get('set-cookie').split(';')[0],
      csrf: resposta.dados.csrf,
      id: resposta.dados.usuario.id,
    };
  }

  function conferir(resposta, status) {
    assert.equal(resposta.status, status, JSON.stringify(resposta.dados));
    return resposta.dados;
  }

  try {
    await t.test('migra registros anteriores sem perder nome, preço e descrição', async () => {
      const antigo = new DatabaseSync(path.join(pasta, 'peregrina.sqlite'));
      antigo.exec(`CREATE TABLE produtos (id INTEGER PRIMARY KEY, nome TEXT NOT NULL,
        preco INTEGER NOT NULL, descricao TEXT NOT NULL) STRICT`);
      antigo.prepare('INSERT INTO produtos VALUES (1, ?, ?, ?)').run('Registro anterior', 12345, 'Descrição preservada');
      antigo.close();
      executar('scripts/criar-admin.cjs', ['--stdin'], pasta, dadosLogin);
      const reserva = new DatabaseSync(path.join(pasta, 'peregrina.sqlite'));
      reserva.exec(`INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo)
        SELECT 2, 'Criador protegido de teste', 'criador@example.test', senha_hash, 'criador', 0
        FROM usuarios WHERE id = 1`);
      reserva.close();
      servidor = await iniciarServidor(pasta);
      admin = await login(dadosLogin.email, dadosLogin.senha);
      const saude = await chamar('/saude');
      assert.equal(saude.status, 200);
      assert.deepEqual(saude.dados, { status: 'ok' });
      const anterior = conferir(await chamar('/api/admin/produtos/1', 'GET', null, admin), 200);
      assert.equal(anterior.nome, 'Registro anterior');
      assert.equal(anterior.preco, 12345);
      assert.equal(anterior.descricao, 'Descrição preservada');
      assert.equal(anterior.estado, 'rascunho');
      const tabelasBanco = conferir(await chamar('/api/admin/banco', 'GET', null, admin), 200);
      assert.ok(tabelasBanco.some((item) => item.nome === 'produtos'));
      const dadosBanco = conferir(await chamar('/api/admin/banco/produtos', 'GET', null, admin), 200);
      assert.equal(dadosBanco.linhas[0].nome, 'Registro anterior');
      const usuariosBanco = conferir(await chamar('/api/admin/banco/usuarios', 'GET', null, admin), 200);
      assert.ok(!JSON.stringify(usuariosBanco).includes('senha_hash'));
      const sessoesBanco = conferir(await chamar('/api/admin/banco/sessoes', 'GET', null, admin), 200);
      assert.ok(!JSON.stringify(sessoesBanco).includes('token_hash'));
      assert.ok(!JSON.stringify(sessoesBanco).includes('csrf'));
      assert.equal((await chamar('/api/admin/banco/inexistente', 'GET', null, admin)).status, 404);
      assert.equal((await chamar('/paginas/banco-de-dados.html')).status, 303);
      assert.equal((await chamar('/admin/banco')).status, 303);
      assert.equal((await chamar('/admin/banco/visualizador.js')).status, 303);
      assert.equal((await chamar('/admin/banco', 'GET', null, admin)).status, 200);
      assert.equal((await chamar('/admin/banco/visualizador.js', 'GET', null, admin)).status, 200);
      assert.equal((await chamar('/admin/banco/visualizador.css', 'GET', null, admin)).status, 200);
      assert.equal((await chamar('/api/admin/banco')).status, 401);
      for (const busca of ['1', '#1', 'ID 1', 'ID #1', ' 1 ']) {
        const encontrados = conferir(await chamar(`/api/admin/produtos?busca=${encodeURIComponent(busca)}`, 'GET', null, admin), 200);
        assert.deepEqual(encontrados.map((item) => item.id), [1], busca);
      }
      assert.deepEqual(conferir(await chamar('/api/admin/produtos?busca=999999', 'GET', null, admin), 200), []);
      assert.equal(conferir(await chamar('/api/admin/produtos?busca=Registro', 'GET', null, admin), 200).length, 1);
      assert.deepEqual(conferir(await chamar('/api/produtos'), 200), []);
      assert.equal(conferir(await chamar('/api/categorias'), 200).length, 6);
      const buscaBanco = conferir(await chamar('/api/admin/banco/produtos/localizar?busca=%231', 'GET', null, admin), 200);
      assert.equal(buscaBanco.total, 1);
      assert.equal(buscaBanco.coluna, 'id');
      assert.equal(buscaBanco.pagina, 1);
      assert.equal(conferir(await chamar('/api/admin/banco/usuarios/localizar?busca=senha_hash', 'GET', null, admin), 200).total, 0);
      const conexaoBusca = new DatabaseSync(path.join(pasta, 'peregrina.sqlite'));
      try {
        const inserir = conexaoBusca.prepare('INSERT INTO categorias (nome, slug) VALUES (?, ?)');
        for (let i = 0; i < 60; i += 1) inserir.run(`Teste de navegação ${i}`, `teste-navegacao-${i}`);
        const local = conferir(await chamar('/api/admin/banco/categorias/localizar?busca=Adesivos', 'GET', null, admin), 200);
        assert.equal(local.total, 1);
        assert.equal(local.pagina, 2);
        const paginaEncontrada = conferir(await chamar('/api/admin/banco/categorias?pagina=2', 'GET', null, admin), 200);
        assert.equal(paginaEncontrada.total, 66);
        assert.equal(paginaEncontrada.linhas[local.linha].nome, 'Adesivos');
        assert.ok(paginaEncontrada.linhas.length > 1);
      } finally {
        conexaoBusca.prepare('DELETE FROM categorias WHERE slug LIKE ?').run('teste-navegacao-%');
        conexaoBusca.close();
      }
    });

    await t.test('autenticação, CSRF, permissões e proteção do último administrador', async () => {
      assert.equal((await chamar('/api/admin/produtos')).status, 401);
      assert.equal((await chamar('/paginas/painel-admin.html')).status, 303);
      assert.equal((await chamar('/api/acesso/entrar', 'POST', { email: dadosLogin.email, senha: 'incorreta' })).status, 401);
      assert.equal((await chamar('/api/admin/categorias', 'POST', { nome: 'Sem CSRF' }, { cookie: admin.cookie, csrf: '' })).status, 403);
      assert.equal((await chamar('/api/admin/categorias', 'POST', {}, admin, { Origin: 'https://outro.example' })).status, 403);
      assert.equal((await chamar(`/api/acesso/usuarios/${admin.id}`, 'PUT', {
        nome: 'Admin', perfil: 'editor', ativo: false,
      }, admin)).status, 400);
      const novo = conferir(await chamar('/api/acesso/usuarios', 'POST', {
        nome: 'Editor de teste', email: 'editor@example.test', senha: 'EditorTeste12345!', perfil: 'editor',
      }, admin), 201);
      editorId = novo.id;
      assert.equal(novo.senha_hash, undefined);
      editor = await login('editor@example.test', 'EditorTeste12345!');
      assert.equal((await chamar('/api/admin/manual')).status, 401);
      for (const acesso of [admin, editor]) {
        const manual = conferir(await chamar('/api/admin/manual', 'GET', null, acesso), 200);
        assert.ok(manual.html.includes('Manual do painel'));
        assert.ok(manual.html.includes('Primeiros passos'));
        const ids = new Set([...manual.html.matchAll(/\bid="([^"]+)"/g)].map((item) => item[1]));
        for (const link of manual.html.matchAll(/data-secao-manual="([^"]+)"/g)) {
          assert.ok(ids.has(`manual-${link[1]}`), link[1]);
        }
      }
      assert.equal((await chamar('/api/acesso/entrar', 'POST', { senha: dadosLogin.senha })).status, 401);
      assert.equal((await chamar('/api/acesso/entrar', 'POST', { senha: 'incorreta' })).status, 401);
      assert.equal((await chamar('/api/acesso/entrar', 'POST', { senha: 'EditorTeste12345!' })).status, 401);
      const paginaLogin = conferir(await chamar('/paginas/entrar-conta.html'), 200);
      assert.match(paginaLogin, /name="email"/);
      assert.match(paginaLogin, /name="senha"/);
      assert.equal((await chamar('/paginas/entrar.html')).status, 303);
      for (const url of ['/api/acesso/usuarios', '/api/admin/configuracoes', '/api/admin/historico', '/api/admin/banco', '/api/admin/banco/produtos', '/paginas/banco-de-dados.html']) {
        assert.equal((await chamar(url, 'GET', null, editor)).status, 403);
      }
      const leitura = new DatabaseSync(path.join(pasta, 'peregrina.sqlite'), { readOnly: true });
      const hash = leitura.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(admin.id).senha_hash;
      assert.match(hash, /^\$2[aby]\$/);
      assert.notEqual(hash, dadosLogin.senha);
      leitura.close();
    });

    await t.test('upload validado e biblioteca reutilizável', async () => {
      assert.equal((await chamar('/api/admin/midias/importar-link', 'POST', {
        url: 'https://127.0.0.1/imagem.png',
      }, editor)).status, 400);
      assert.equal((await chamar('/api/admin/midias/importar-link', 'POST', {
        url: 'file:///dados/imagem.png',
      }, editor)).status, 400);
      const invalida = new FormData();
      invalida.set('imagem', new Blob(['<svg><script>alert(1)</script></svg>'], { type: 'image/png' }), 'falsa.png');
      assert.equal((await chamar('/api/admin/midias', 'POST', invalida, editor)).status, 400);
      const grande = new FormData();
      grande.set('imagem', new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: 'image/png' }), 'grande.png');
      assert.equal((await chamar('/api/admin/midias', 'POST', grande, editor)).status, 413);
      const arquivo = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#00afe3' } }).png().toBuffer();
      const dados = new FormData();
      dados.set('imagem', new Blob([arquivo], { type: 'image/png' }), 'teste.png');
      dados.set('nome', 'Nome escolhido para a imagem');
      dados.set('alternativo', 'Imagem exclusiva do teste');
      dados.set('pasta', 'Testes');
      midia = conferir(await chamar('/api/admin/midias', 'POST', dados, editor), 201);
      assert.equal(midia.largura, 40);
      assert.equal(midia.nome, 'Nome escolhido para a imagem');
      midia = conferir(await chamar(`/api/admin/midias/${midia.id}`, 'PUT', {
        nome: 'Imagem com nome editado',
      }, editor), 200);
      assert.equal(midia.nome, 'Imagem com nome editado');
      assert.equal(midia.alternativo, 'Imagem com nome editado');
      assert.equal(midia.pasta, 'Testes');
      midia = conferir(await chamar(`/api/admin/midias/${midia.id}`, 'PUT', {
        nome: midia.nome, alternativo: 'Sacola kraft com alça de cordão e logo azul.',
      }, editor), 200);
      assert.equal(midia.alternativo, 'Sacola kraft com alça de cordão e logo azul.');
      assert.equal(conferir(await chamar('/api/admin/midias', 'GET', null, editor), 200)
        .find((item) => item.id === midia.id).nome, 'Imagem com nome editado');
      assert.match(midia.url, /\.webp$/);
      assert.equal((await chamar(midia.url)).status, 200);
    });

    await t.test('rascunho, variações, precisão monetária, prévia e publicação', async () => {
      categoria = conferir(await chamar('/api/admin/categorias', 'GET', null, editor), 200)[0];
      dadosBase = {
        nome: 'Produto de teste', descricao: 'Descrição real de teste.', slug: 'produto-de-teste',
        categoria_id: categoria.id, comercial: 'preco', imagem_id: midia.id, galeria: [midia.id],
        posicao: 1, destaque: true, tiragens: [100, 500],
        caracteristicas: [{
          id: 'material', nome: 'Material', tipo: 'selecao', ativo: true, valor: '',
          valores: [{ id: 'papel', nome: 'Papel', ativo: true, imagem_id: midia.id },
            { id: 'adesivo', nome: 'Adesivo', ativo: true }],
        }],
        variacoes: [
          { opcoes: { material: 'papel' }, quantidade: 100, total: '99,90', ativa: true, disponivel: true },
          { opcoes: { material: 'adesivo' }, quantidade: 500, total: '450.00', ativa: true, disponivel: true },
        ],
      };
      assert.equal((await chamar('/api/admin/produtos', 'POST', dadosBase)).status, 401);
      produto = conferir(await chamar('/api/admin/produtos', 'POST', dadosBase, editor), 201);
      const literal = conferir(await chamar(`/api/admin/produtos/${produto.id}`, 'PUT', {
        ...produto, nome: "Teste '); DROP TABLE produtos; --", descricao: '<script>texto literal</script>',
      }, editor), 200);
      assert.equal(literal.nome, "Teste '); DROP TABLE produtos; --");
      assert.equal(literal.descricao, '<script>texto literal</script>');
      produto = conferir(await chamar(`/api/admin/produtos/${produto.id}`, 'PUT', {
        ...literal, nome: dadosBase.nome, descricao: dadosBase.descricao,
      }, editor), 200);
      assert.deepEqual(conferir(await chamar('/api/produtos'), 200), []);
      const previa = conferir(await chamar(`/api/admin/produtos/${produto.id}/previa`, 'GET', null, editor), 200);
      assert.equal(previa.menor_preco.total_centavos, 9990);
      assert.equal(previa.menor_preco.quantidade, 100);
      assert.equal(previa.numero_opcoes, 2);
      assert.equal(previa.numero_variacoes, 2);
      assert.equal((await chamar(`/api/admin/produtos/${produto.id}/previa`)).status, 401);
      const duplicada = { ...dadosBase, slug: 'outra', variacoes: [dadosBase.variacoes[0], dadosBase.variacoes[0]] };
      assert.equal((await chamar('/api/admin/produtos', 'POST', duplicada, editor)).status, 400);
      const zero = { ...dadosBase, slug: 'outra', variacoes: [{ ...dadosBase.variacoes[0], total: '0' }] };
      assert.equal((await chamar('/api/admin/produtos', 'POST', zero, editor)).status, 400);
      conferir(await chamar(`/api/admin/produtos/${produto.id}/estado`, 'POST', { acao: 'publicar' }, editor), 200);
      const publico = conferir(await chamar('/api/produtos/produto-de-teste'), 200);
      assert.match(conferir(await chamar('/produtos/produto-de-teste'), 200), /Produto de teste \|/);
      const paginaProduto = conferir(await chamar('/produtos/produto-de-teste'), 200);
      assert.match(paginaProduto, /id="produto-detalhe"/);
      assert.match(paginaProduto, /js\/produto\.js/);
      assert.doesNotMatch(paginaProduto, /id="catalogo-produtos"/);
      assert.equal((await chamar('/produtos/produto-inexistente')).status, 404);
      const paginaHtml = conferir(await chamar('/paginas/produto.html?produto=produto-de-teste'), 200);
      assert.match(paginaHtml, /Produto de teste \|/);
      assert.match(paginaHtml, /id="produto-detalhe"/);
      assert.equal((await chamar('/paginas/produto.html?produto=inexistente')).status, 404);
      assert.equal(publico.variacoes[0].total_centavos, 9990);
      assert.equal(publico.variacoes[0].codigo, undefined);
      assert.equal(publico.estado, undefined);
      assert.equal((await chamar(`/api/admin/midias/${midia.id}`, 'DELETE', null, editor)).status, 409);
      const usos = conferir(await chamar('/api/admin/midias', 'GET', null, editor), 200)[0].usos;
      assert.ok(usos.some((uso) => uso.includes(produto.nome)));
    });

    await t.test('substitui imagem vinculada sem republicar rascunhos e invalida endereços antigos', async () => {
      const anterior = { ...midia };
      const outro = conferir(await chamar('/api/admin/produtos', 'POST', {
        ...dadosBase, slug: 'outro-produto', nome: 'Outro produto',
      }, editor), 201);
      conferir(await chamar(`/api/admin/produtos/${outro.id}/estado`, 'POST', { acao: 'publicar' }, editor), 200);
      conferir(await chamar(`/api/admin/produtos/${outro.id}`, 'PUT', {
        ...outro, descricao: 'Alteração ainda não publicada.',
      }, editor), 200);
      const arquivo = await sharp({ create: { width: 75, height: 60, channels: 3, background: '#ff0088' } }).png().toBuffer();
      function envio(conteudo = arquivo) {
        const dados = new FormData();
        dados.set('imagem', new Blob([conteudo], { type: 'image/png' }), 'nova.png');
        dados.set('arquivo_anterior', anterior.arquivo);
        return dados;
      }
      const rota = `/api/admin/midias/${midia.id}/substituir`;
      const porLink = { url: 'https://127.0.0.1/imagem.png', arquivo_anterior: anterior.arquivo };
      assert.equal((await chamar(rota, 'POST', porLink)).status, 401);
      assert.equal((await chamar(rota, 'POST', porLink, editor, { 'X-CSRF-Token': 'invalido' })).status, 403);
      for (const url of ['https://127.0.0.1/imagem.png', 'http://example.com/imagem.png', 'file:///imagem.png']) {
        assert.equal((await chamar(rota, 'POST', { ...porLink, url }, editor)).status, 400);
      }
      const mantida = conferir(await chamar('/api/admin/midias', 'GET', null, editor), 200)
        .find(item => item.id === midia.id);
      assert.equal(mantida.arquivo, anterior.arquivo);
      assert.equal((await chamar(rota, 'POST', envio())).status, 401);
      assert.equal((await chamar(rota, 'POST', envio(), editor, { 'X-CSRF-Token': 'invalido' })).status, 403);
      assert.equal((await chamar(rota, 'POST', envio(Buffer.from('invalida')), editor)).status, 400);
      assert.equal((await chamar(anterior.url)).status, 200);
      midia = conferir(await chamar(rota, 'POST', envio(), editor), 200);
      assert.equal(midia.id, anterior.id);
      assert.equal(midia.nome, anterior.nome);
      assert.equal(midia.alternativo, anterior.alternativo);
      assert.equal(midia.pasta, anterior.pasta);
      assert.equal(midia.largura, 75);
      assert.equal(midia.altura, 60);
      assert.notEqual(midia.url, anterior.url);
      assert.notEqual(midia.miniatura_url, anterior.miniatura_url);
      assert.equal((await chamar(rota, 'POST', envio(), editor)).status, 409);
      assert.equal((await chamar(anterior.url)).status, 404);
      assert.equal((await chamar(midia.url)).status, 200);
      assert.equal((await chamar(midia.miniatura_url)).status, 200);
      for (const slug of ['produto-de-teste', 'outro-produto']) {
        const publico = conferir(await chamar(`/api/produtos/${slug}`), 200);
        assert.equal(publico.imagem.url, midia.url);
        assert.equal(publico.galeria[0].url, midia.url);
        assert.equal(publico.caracteristicas[0].valores[0].imagem.url, midia.url);
        assert.equal(publico.descricao, dadosBase.descricao);
      }
      const rascunho = conferir(await chamar(`/api/admin/produtos/${outro.id}`, 'GET', null, editor), 200);
      assert.equal(rascunho.descricao, 'Alteração ainda não publicada.');
      assert.equal(rascunho.pendente, true);
      conferir(await chamar(`/api/admin/produtos/${outro.id}`, 'DELETE', null, admin), 204);
    });

    await t.test('estoque interno permite alteração rápida, protege concorrência e preserva publicação', async () => {
      const caminho = `/api/admin/produtos/${produto.id}`;
      const anterior = conferir(await chamar(caminho, 'GET', null, editor), 200);
      assert.equal(anterior.estoque, null);
      assert.equal((await chamar(`${caminho}/estoque`, 'PUT', { estoque: 25, estoque_anterior: null })).status, 401);
      const salvo = conferir(await chamar(`${caminho}/estoque`, 'PUT', { estoque: 25, estoque_anterior: null }, editor), 200);
      assert.equal(salvo.estoque, 25);
      const atual = conferir(await chamar(caminho, 'GET', null, editor), 200);
      assert.equal(atual.estoque, 25);
      assert.equal(atual.pendente, false);
      const publico = conferir(await chamar('/api/produtos/produto-de-teste'), 200);
      assert.equal(publico.estoque, undefined);
      assert.equal(publico.variacoes[0].total_centavos, 9990);
      assert.equal((await chamar(`${caminho}/estoque`, 'PUT', { estoque: 30, estoque_anterior: null }, editor)).status, 409);
      assert.equal((await chamar(caminho, 'PUT', { ...anterior, estoque: 7 }, editor)).status, 409);
      for (const estoque of [-1, 1.5, true, 10000001]) {
        assert.equal((await chamar(`${caminho}/estoque`, 'PUT', { estoque, estoque_anterior: 25 }, editor)).status, 400);
      }
      assert.equal(conferir(await chamar(`${caminho}/estoque`, 'PUT', { estoque: 0, estoque_anterior: 25 }, editor), 200).estoque, 0);
      assert.equal(conferir(await chamar(`${caminho}/estoque`, 'PUT', { estoque: null, estoque_anterior: 0 }, editor), 200).estoque, null);
      const base = conferir(await chamar(caminho, 'GET', null, editor), 200);
      conferir(await chamar(caminho, 'PUT', { ...base, estoque: 13, descricao: 'Descrição ainda em rascunho.' }, editor), 200);
      conferir(await chamar(`${caminho}/estoque`, 'PUT', { estoque: 12, estoque_anterior: 13 }, editor), 200);
      assert.equal(conferir(await chamar(caminho, 'GET', null, editor), 200).pendente, true);
      assert.equal(conferir(await chamar('/api/produtos/produto-de-teste'), 200).descricao, base.descricao);
      const versao = conferir(await chamar(caminho, 'GET', null, editor), 200);
      conferir(await chamar(caminho, 'PUT', { ...base, estoque: null, atualizado_em: versao.atualizado_em }, editor), 200);
      conferir(await chamar(`${caminho}/estado`, 'POST', { acao: 'publicar' }, editor), 200);
      produto = conferir(await chamar(caminho, 'GET', null, editor), 200);
    });

    await t.test('edição rápida pelo catálogo altera somente nome e estoque e exige administrador', async () => {
      const copia = conferir(await chamar(`/api/admin/produtos/${produto.id}/duplicar`, 'POST', {}, admin), 201);
      const caminho = `/api/admin/produtos/${copia.id}`;
      const rapido = `${caminho}/edicao-rapida`;
      assert.equal((await chamar(rapido, 'GET', null, admin)).status, 404);
      conferir(await chamar(`${caminho}/estado`, 'POST', { acao: 'publicar' }, admin), 200);
      const publicado = conferir(await chamar(caminho, 'GET', null, admin), 200);
      conferir(await chamar(caminho, 'PUT', { ...publicado, descricao: 'Descrição pendente que não pode ser publicada.' }, admin), 200);
      const inicial = conferir(await chamar(rapido, 'GET', null, admin), 200);
      const dados = { nome: 'Nome alterado no catálogo', nome_anterior: inicial.nome, estoque: 10, estoque_anterior: inicial.estoque };
      assert.equal((await chamar(rapido)).status, 401);
      assert.equal((await chamar(rapido, 'GET', null, editor)).status, 403);
      assert.equal((await chamar(rapido, 'PUT', dados, editor)).status, 403);
      assert.equal((await chamar(rapido, 'PUT', dados, admin, { 'X-CSRF-Token': 'errado' })).status, 403);
      assert.equal((await chamar(rapido, 'PUT', { ...dados, estoque: -1 }, admin)).status, 400);
      const salvo = conferir(await chamar(rapido, 'PUT', dados, admin), 200);
      assert.deepEqual(salvo, { nome: dados.nome, estoque: 10 });
      const visivel = conferir(await chamar(`/api/produtos/${publicado.slug}`), 200);
      assert.equal(visivel.nome, dados.nome);
      assert.equal(visivel.descricao, publicado.descricao);
      assert.equal(visivel.estoque, undefined);
      const rascunho = conferir(await chamar(caminho, 'GET', null, admin), 200);
      assert.equal(rascunho.pendente, true);
      assert.equal(rascunho.descricao, 'Descrição pendente que não pode ser publicada.');
      assert.equal((await chamar(rapido, 'PUT', dados, admin)).status, 409);
      conferir(await chamar(caminho, 'DELETE', null, admin), 204);
    });

    await t.test('visão geral usa dados reais, separa permissões e abre filtros correspondentes', async () => {
      const caminho = `/api/admin/produtos/${produto.id}`;
      const inicial = conferir(await chamar(caminho, 'GET', null, admin), 200);
      conferir(await chamar(`${caminho}/estoque`, 'PUT', { estoque: 0, estoque_anterior: inicial.estoque }, admin), 200);
      const todos = conferir(await chamar('/api/admin/produtos', 'GET', null, admin), 200);
      const publicos = conferir(await chamar('/api/produtos'), 200);
      const resumo = conferir(await chamar('/api/admin/visao-geral', 'GET', null, admin), 200);
      assert.equal(resumo.resumo.total, todos.length);
      assert.equal(resumo.resumo.visiveis, publicos.length);
      assert.equal(resumo.resumo.sob_orcamento, publicos.filter((item) => !item.menor_preco).length);
      assert.equal(resumo.estoque.zerados.length, todos.filter((item) => item.estado !== 'arquivado' && item.estoque === 0).length);
      assert.ok(resumo.estoque.zerados.some((item) => item.id === produto.id));
      assert.equal(resumo.categorias.reduce((total, item) => total + item.visiveis, 0), publicos.length);
      assert.equal(resumo.contas.total, conferir(await chamar('/api/acesso/contas', 'GET', null, admin), 200).length);
      assert.equal(resumo.backup, undefined);
      const leituraEditor = conferir(await chamar('/api/admin/visao-geral', 'GET', null, editor), 200);
      assert.equal(leituraEditor.contas, undefined);
      assert.equal(leituraEditor.backup, undefined);
      assert.ok(leituraEditor.recentes.every((item) => ['produto', 'categoria', 'midia', 'conteudo', 'catalogo'].includes(item.entidade)));
      for (const [filtro, esperado] of [
        ['estoque=zerado', todos.filter((item) => item.estoque === 0)],
        ['estoque=zerado&estado=ativos', todos.filter((item) => item.estoque === 0 && item.estado !== 'arquivado')],
        ['estoque=sem-controle', todos.filter((item) => item.estoque === null)],
        ['revisao=alteracoes', todos.filter((item) => item.pendente)],
        ['revisao=prontos', todos.filter((item) => item.estado === 'rascunho' && !item.pendencias.length)],
        ['revisao=pendencias', todos.filter((item) => item.estado !== 'arquivado' && item.pendencias.length)],
      ]) {
        const filtrados = conferir(await chamar(`/api/admin/produtos?${filtro}`, 'GET', null, editor), 200);
        assert.deepEqual(filtrados.map((item) => item.id), esperado.map((item) => item.id), filtro);
      }
      conferir(await chamar(`${caminho}/estoque`, 'PUT', { estoque: inicial.estoque, estoque_anterior: 0 }, admin), 200);
      produto = conferir(await chamar(caminho, 'GET', null, admin), 200);
    });

    await t.test('orçamento público confere configurações, preços alterados e itens indisponíveis', async () => {
      const base = { id: 'item-a', produto_id: produto.id, quantidade: 100, opcoes: { material: 'papel' }, total_centavos: 1 };
      const validar = async (itens) => conferir(await chamar('/api/orcamento/validar', 'POST', { itens }), 200);
      const valido = await validar([base]);
      assert.equal(valido.pode_enviar, true);
      assert.equal(valido.itens[0].total_centavos, 9990);
      assert.equal(valido.subtotal_centavos, 9990);
      assert.equal(valido.itens[0].quantidade, 100);
      assert.equal((await validar([{ ...base, quantidade: 125 }])).pode_enviar, false);
      assert.equal((await validar([{ ...base, opcoes: { material: 'inventado' } }])).pode_enviar, false);
      assert.equal((await validar([{ ...base, quantidade: 0 }])).pode_enviar, false);
      const semPreco = await validar([{ ...base, quantidade: 500 }]);
      assert.equal(semPreco.pode_enviar, true);
      assert.equal(semPreco.itens[0].total_centavos, null);
      const misto = await validar([base, { ...base, id: 'item-b', quantidade: 500 }]);
      assert.equal(misto.com_preco, 1);
      assert.equal(misto.sob_orcamento, 1);
      assert.equal(misto.subtotal_centavos, 9990);
      const copia = conferir(await chamar(`/api/admin/produtos/${produto.id}/duplicar`, 'POST', {}, editor), 201);
      try {
        const alterado = conferir(await chamar(`/api/admin/produtos/${copia.id}`, 'PUT', {
          ...copia, variacoes: copia.variacoes.map((item) => ({ ...item, total: '120.00' })),
        }, editor), 200);
        conferir(await chamar(`/api/admin/produtos/${copia.id}/estado`, 'POST', { acao: 'publicar' }, editor), 200);
        assert.equal((await validar([{ ...base, produto_id: copia.id }])).itens[0].total_centavos, 12000);
        conferir(await chamar(`/api/admin/produtos/${copia.id}`, 'PUT', { ...alterado, comercial: 'orcamento' }, editor), 200);
        conferir(await chamar(`/api/admin/produtos/${copia.id}/estado`, 'POST', { acao: 'publicar' }, editor), 200);
        assert.equal((await validar([{ ...base, produto_id: copia.id }])).itens[0].total_centavos, null);
        conferir(await chamar(`/api/admin/produtos/${copia.id}/estado`, 'POST', { acao: 'arquivar' }, editor), 200);
        assert.equal((await validar([{ ...base, produto_id: copia.id }])).pode_enviar, false);
      } finally {
        conferir(await chamar(`/api/admin/produtos/${copia.id}`, 'DELETE', null, editor), 204);
      }
      assert.equal((await chamar('/api/orcamento/validar', 'POST', { itens: Array(51).fill(base) })).status, 400);
      assert.match(conferir(await chamar('/paginas/orcamento.html'), 200), /Meu carrinho/);
    });

    await t.test('edição preserva publicação, duplicação, lote atômico e arquivamento', async () => {
      const alterado = { ...produto, nome: 'Nome atualizado' };
      produto = conferir(await chamar(`/api/admin/produtos/${produto.id}`, 'PUT', alterado, editor), 200);
      assert.equal(conferir(await chamar('/api/produtos'), 200)[0].nome, 'Produto de teste');
      const copia = conferir(await chamar(`/api/admin/produtos/${produto.id}/duplicar`, 'POST', {}, editor), 201);
      assert.equal(copia.estado, 'rascunho');
      assert.notEqual(copia.slug, produto.slug);
      assert.equal((await chamar('/api/admin/lote', 'POST', { ids: [produto.id, 999999], acao: 'arquivar' }, admin)).status, 404);
      assert.equal(conferir(await chamar('/api/produtos'), 200).length, 1);
      conferir(await chamar(`/api/admin/produtos/${produto.id}/estado`, 'POST', { acao: 'publicar' }, editor), 200);
      assert.equal(conferir(await chamar('/api/produtos'), 200)[0].nome, 'Nome atualizado');
      conferir(await chamar(`/api/admin/produtos/${produto.id}/estado`, 'POST', { acao: 'arquivar' }, editor), 200);
      assert.equal((await chamar('/api/produtos/produto-de-teste')).status, 404);
      assert.equal((await chamar('/produtos/produto-de-teste')).status, 404);
      conferir(await chamar(`/api/admin/produtos/${produto.id}/estado`, 'POST', { acao: 'restaurar' }, editor), 200);
      assert.equal(conferir(await chamar('/api/produtos'), 200).length, 0);
      conferir(await chamar(`/api/admin/produtos/${produto.id}/estado`, 'POST', { acao: 'publicar' }, editor), 200);
    });

    await t.test('categorias e valores inativos preservam registros', async () => {
      conferir(await chamar(`/api/admin/categorias/${categoria.id}`, 'PUT', { ...categoria, ativa: false }, editor), 200);
      assert.equal(conferir(await chamar('/api/produtos'), 200).length, 0);
      conferir(await chamar(`/api/admin/categorias/${categoria.id}`, 'PUT', { ...categoria, ativa: true }, editor), 200);
      produto = conferir(await chamar(`/api/admin/produtos/${produto.id}`, 'GET', null, editor), 200);
      const semValores = structuredClone(produto);
      semValores.caracteristicas[0].valores = [];
      assert.equal((await chamar(`/api/admin/produtos/${produto.id}`, 'PUT', semValores, editor)).status, 400);
      const inativo = structuredClone(produto);
      inativo.caracteristicas[0].valores[1].ativo = false;
      produto = conferir(await chamar(`/api/admin/produtos/${produto.id}`, 'PUT', inativo, editor), 200);
      assert.equal(produto.variacoes.length, 2);
      assert.equal(conferir(await chamar(`/api/admin/produtos/${produto.id}/previa`, 'GET', null, editor), 200).numero_variacoes, 1);
    });

    await t.test('landing page, contatos e exportação refletem dados do servidor', async () => {
      const secoes = conferir(await chamar('/api/admin/conteudo', 'GET', null, editor), 200);
      secoes[0].titulo = 'Título de prévia';
      conferir(await chamar('/api/admin/conteudo', 'PUT', secoes, editor), 200);
      assert.notEqual(conferir(await chamar('/api/site'), 200).secoes[0].titulo, 'Título de prévia');
      assert.equal(conferir(await chamar('/api/admin/previa-site', 'GET', null, editor), 200).secoes[0].titulo, 'Título de prévia');
      conferir(await chamar('/api/admin/conteudo/publicar', 'POST', {}, editor), 200);
      assert.equal(conferir(await chamar('/api/site'), 200).secoes[0].titulo, 'Título de prévia');
      const configuracao = conferir(await chamar('/api/admin/configuracoes', 'GET', null, admin), 200);
      conferir(await chamar('/api/admin/configuracoes', 'PUT', { ...configuracao, titulo: 'Título atualizado' }, admin), 200);
      assert.match(conferir(await chamar('/'), 200), /<title>Título atualizado<\/title>/);
      assert.equal(conferir(await chamar('/api/admin/exportar', 'GET', null, editor), 200).produtos.length, 3);
      const historico = conferir(await chamar('/api/admin/historico', 'GET', null, admin), 200);
      assert.ok(historico.length > 5);
      assert.ok(!JSON.stringify(historico).includes(dadosLogin.senha));
    });

    await t.test('exclusão definitiva remove produto e preços, preserva imagens e registra autoria', async () => {
      const copia = conferir(await chamar(`/api/admin/produtos/${produto.id}/duplicar`, 'POST', {}, editor), 201);
      conferir(await chamar(`/api/admin/produtos/${copia.id}/estado`, 'POST', { acao: 'publicar' }, editor), 200);
      assert.equal((await chamar(`/api/admin/produtos/${copia.id}`, 'DELETE')).status, 401);
      assert.equal((await chamar(`/api/admin/produtos/${copia.id}`, 'DELETE', null,
        { cookie: editor.cookie, csrf: '' })).status, 403);
      conferir(await chamar(`/api/admin/produtos/${copia.id}`, 'DELETE', null, editor), 204);
      assert.equal((await chamar(`/api/admin/produtos/${copia.id}`, 'GET', null, editor)).status, 404);
      assert.equal((await chamar(`/api/produtos/${copia.slug}`)).status, 404);
      assert.equal((await chamar(`/paginas/produto.html?produto=${copia.slug}`)).status, 404);
      assert.equal((await chamar(midia.url)).status, 200);
      assert.equal((await chamar(`/api/admin/produtos/${produto.id}`, 'GET', null, editor)).status, 200);
      const leitura = new DatabaseSync(path.join(pasta, 'peregrina.sqlite'), { readOnly: true });
      assert.equal(leitura.prepare('SELECT COUNT(*) AS total FROM variacoes WHERE produto_id = ?').get(copia.id).total, 0);
      leitura.close();
      const historico = conferir(await chamar('/api/admin/historico', 'GET', null, admin), 200);
      assert.ok(historico.some((item) => item.acao === 'Excluiu produto definitivamente' && item.usuario_id === editor.id));
      assert.equal((await chamar(`/api/admin/produtos/${copia.id}`, 'DELETE', null, editor)).status, 404);
    });

    await t.test('recuperação temporária, desativação de conta e revogação de sessão', async () => {
      const acesso = conferir(await chamar(`/api/acesso/usuarios/${editorId}/recuperacao`, 'POST', {}, admin), 200);
      conferir(await chamar('/api/acesso/recuperar', 'POST', { token: acesso.token, senha: 'NovaSenhaEditor123!' }), 200);
      assert.equal((await chamar('/api/admin/produtos', 'GET', null, editor)).status, 401);
      assert.equal((await chamar('/api/acesso/recuperar', 'POST', { token: acesso.token, senha: 'OutraSenhaEditor123!' })).status, 400);
      editor = await login('editor@example.test', 'NovaSenhaEditor123!');
      conferir(await chamar(`/api/acesso/usuarios/${editorId}`, 'PUT', { nome: 'Editor', perfil: 'editor', ativo: false }, admin), 200);
      assert.equal((await chamar('/api/admin/produtos', 'GET', null, editor)).status, 401);
    });

    await t.test('imagens e banco persistem; backup restaura com integridade e sem sessões antigas', async () => {
      await servidor.encerrar();
      servidor = await iniciarServidor(pasta);
      assert.equal((await chamar(midia.url)).status, 200);
      assert.equal(conferir(await chamar('/api/produtos'), 200).length, 1);
      await servidor.encerrar();
      const destino = path.join(pasta, 'copia-verificada');
      executar('scripts/backup.cjs', [destino], pasta);
      assert.ok(fs.existsSync(path.join(destino, 'manifesto.json')));
      executar('scripts/restaurar.cjs', [destino, '--confirmar'], pasta);
      servidor = await iniciarServidor(pasta);
      assert.equal((await chamar('/api/admin/produtos', 'GET', null, admin)).status, 401);
      admin = await login(dadosLogin.email, dadosLogin.senha);
      assert.equal((await chamar(midia.url)).status, 200);
      assert.equal(conferir(await chamar('/api/admin/produtos', 'GET', null, admin), 200).length, 3);
    });
  } finally {
    if (servidor) await servidor.encerrar();
    const resolvido = fs.realpathSync(pasta);
    assert.equal(path.dirname(resolvido), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolvido).startsWith('peregrina-sistema-'));
    fs.rmSync(resolvido, { recursive: true, force: true });
  }
});
