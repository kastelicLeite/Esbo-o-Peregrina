const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { banco, pastaDados, registrar, transacao } = require('../dados/banco.cjs');
const { texto, exigir } = require('../http/validacao.cjs');

const { importarUrl } = require('./importar-url.cjs');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 3, fieldSize: 4096, parts: 4 },
});

function usos(id) {
  const produtos = banco.prepare('SELECT id, nome, imagem_id, galeria, caracteristicas, publicado_json FROM produtos').all()
    .filter((item) => item.imagem_id === id || JSON.parse(item.galeria).includes(id)
      || item.caracteristicas.includes(`"${id}"`)
      || item.publicado_json?.includes(`"${id}"`))
    .map((item) => `Produto: ${item.nome} (#${item.id})`);
  const conteudo = banco.prepare('SELECT rascunho, publicado FROM conteudos WHERE id = 1').get();
  if (conteudo.rascunho.includes(`"${id}"`) || conteudo.publicado.includes(`"${id}"`)) produtos.push('Landing page');
  const configuracao = banco.prepare('SELECT dados FROM configuracoes WHERE id = 1').get();
  if (configuracao.dados.includes(`"${id}"`)) produtos.push('Configurações e compartilhamento');
  return produtos;
}

function apresentar(item) {
  return { ...item, url: `/midias/${item.arquivo}`, miniatura_url: `/midias/${item.miniatura}`, usos: usos(item.id) };
}

router.get('/midias', (pedido, resposta) => {
  resposta.json(banco.prepare('SELECT * FROM midias ORDER BY criado_em DESC').all().map(apresentar));
});

async function salvarImagem(pedido, anterior = null) {
  exigir(pedido.file, 'Selecione uma imagem.');
  const nome = pedido.body.nome === undefined
    ? anterior?.nome || path.basename(pedido.file.originalname).slice(0, 150)
    : texto(pedido.body.nome, 150, 'o nome da imagem');
  const alternativo = texto(pedido.body.alternativo ?? anterior?.alternativo ?? nome, 300, 'o texto alternativo', false);
  const pasta = texto(pedido.body.pasta ?? anterior?.pasta ?? '', 80, 'a pasta', false);
  const imagem = sharp(pedido.file.buffer, { limitInputPixels: 32000000, failOn: 'warning' });
  let metadados;
  try { metadados = await imagem.metadata(); } catch { exigir(false, 'O arquivo não contém uma imagem válida.'); }
  exigir(['jpeg', 'png', 'webp', 'heif'].includes(metadados.format) && (metadados.pages || 1) === 1,
    'Envie uma imagem estática JPG, PNG, WebP ou AVIF.');
  const id = anterior?.id || randomUUID();
  const versao = anterior ? randomUUID() : id;
  const arquivo = `${versao}.webp`;
  const miniatura = `${versao}-mini.webp`;
  const destino = path.join(pastaDados, 'imagens', arquivo);
  const destinoMini = path.join(pastaDados, 'imagens', miniatura);
  try {
    const otimizada = await imagem.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    await sharp(otimizada.data).resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 }).toFile(destinoMini);
    fs.writeFileSync(destino, otimizada.data, { flag: 'wx' });
    transacao(() => {
      if (anterior) {
        const atual = banco.prepare('SELECT arquivo FROM midias WHERE id = ?').get(id);
        exigir(atual?.arquivo === anterior.arquivo,
          'Esta imagem foi alterada ou excluída. Atualize a biblioteca antes de substituir.', 409);
        banco.prepare(`UPDATE midias SET arquivo = ?, miniatura = ?, largura = ?, altura = ?, bytes = ? WHERE id = ?`)
          .run(arquivo, miniatura, otimizada.info.width, otimizada.info.height, otimizada.data.length, id);
      } else {
        banco.prepare(`INSERT INTO midias (id, nome, arquivo, miniatura, alternativo, pasta, largura, altura, bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, nome, arquivo, miniatura,
            alternativo, pasta, otimizada.info.width, otimizada.info.height, otimizada.data.length);
      }
      registrar(pedido.usuario, anterior ? 'Substituiu imagem mantendo vínculos' : 'Enviou imagem', 'midia', id);
    });
  } catch (erro) {
    for (const alvo of [destino, destinoMini]) {
      if (fs.existsSync(alvo)) fs.unlinkSync(alvo);
    }
    throw erro;
  }
  if (anterior) {
    for (const antigo of [anterior.arquivo, anterior.miniatura]) {
      try { fs.rmSync(path.join(pastaDados, 'imagens', antigo), { force: true }); }
      catch (erro) { console.warn('Não foi possível remover a versão anterior da imagem:', erro.code); }
    }
  }
  return apresentar(banco.prepare('SELECT * FROM midias WHERE id = ?').get(id));
}

router.post('/midias', upload.single('imagem'), async (pedido, resposta) => {
  resposta.status(201).json(await salvarImagem(pedido));
});

router.post('/midias/:id/substituir', upload.single('imagem'), async (pedido, resposta) => {
  const registro = banco.prepare('SELECT * FROM midias WHERE id = ?').get(pedido.params.id);
  exigir(registro, 'Imagem não encontrada.', 404);
  exigir(pedido.body?.arquivo_anterior === registro.arquivo,
    'Esta imagem foi alterada. Atualize a biblioteca antes de substituir.', 409);
  const file = pedido.body.url ? await importarUrl(pedido.body.url) : pedido.file;
  resposta.json(await salvarImagem({ file, body: pedido.body, usuario: pedido.usuario }, registro));
});

router.post('/midias/importar-link', async (pedido, resposta) => {
  const file = await importarUrl(pedido.body?.url);
  resposta.status(201).json(await salvarImagem({ file, body: pedido.body, usuario: pedido.usuario }));
});

router.put('/midias/:id', (pedido, resposta) => {
  const registro = banco.prepare('SELECT * FROM midias WHERE id = ?').get(pedido.params.id);
  exigir(registro, 'Imagem não encontrada.', 404);
  const nome = pedido.body.nome === undefined ? registro.nome : texto(pedido.body.nome, 150, 'o nome da imagem');
  banco.prepare('UPDATE midias SET nome = ?, alternativo = ?, pasta = ? WHERE id = ?')
    .run(nome, texto(pedido.body.alternativo ?? (pedido.body.nome === undefined ? registro.alternativo : nome),
      300, 'o texto alternativo', false),
    texto(pedido.body.pasta ?? registro.pasta, 80, 'a pasta', false), pedido.params.id);
  registrar(pedido.usuario, 'Atualizou imagem', 'midia', pedido.params.id);
  resposta.json(apresentar(banco.prepare('SELECT * FROM midias WHERE id = ?').get(pedido.params.id)));
});

router.delete('/midias/:id', (pedido, resposta) => {
  const registro = banco.prepare('SELECT * FROM midias WHERE id = ?').get(pedido.params.id);
  exigir(registro, 'Imagem não encontrada.', 404);
  exigir(!usos(registro.id).length, 'A imagem está vinculada. Remova os vínculos antes de excluir.', 409);
  transacao(() => {
    banco.prepare('DELETE FROM midias WHERE id = ?').run(registro.id);
    registrar(pedido.usuario, 'Excluiu imagem sem vínculos', 'midia', registro.id);
  });
  for (const arquivo of [registro.arquivo, registro.miniatura]) {
    const alvo = path.join(pastaDados, 'imagens', arquivo);
    if (fs.existsSync(alvo)) fs.unlinkSync(alvo);
  }
  resposta.status(204).end();
});

module.exports = router;
