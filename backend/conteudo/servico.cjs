const { banco, transacao, registrar } = require('../dados/banco.cjs');
const { configuracoes: padroes, secoes } = require('../dados/padroes.cjs');
const { texto, exigir, inteiro } = require('../http/validacao.cjs');
const { imagem } = require('../produtos/servico.cjs');

function configuracoes() {
  return JSON.parse(banco.prepare('SELECT dados FROM configuracoes WHERE id = 1').get().dados);
}

function salvarConfiguracoes(dados, usuario) {
  exigir(dados && typeof dados === 'object', 'Informe as configurações.');
  const resultado = {};
  for (const chave of Object.keys(padroes)) {
    resultado[chave] = texto(dados[chave] || '', ['descricao', 'privacidade'].includes(chave) ? 6000 : 500,
      chave.replaceAll('_', ' '), ['whatsapp', 'titulo', 'mensagem', 'mensagem_produto'].includes(chave));
  }
  exigir(/^\d{10,15}$/.test(resultado.whatsapp), 'Informe o WhatsApp com código do país e DDD, somente números.');
  exigir(!resultado.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resultado.email), 'Informe um e-mail válido.');
  for (const chave of ['instagram', 'facebook']) {
    if (resultado[chave]) {
      let url;
      try { url = new URL(resultado[chave]); } catch { exigir(false, `Confira o endereço de ${chave}.`); }
      exigir(url.protocol === 'https:', 'Use endereços de redes sociais iniciados por https://.');
    }
  }
  for (const chave of ['favicon', 'imagem_compartilhamento']) {
    exigir(!resultado[chave] || imagem(resultado[chave]), 'Selecione uma imagem existente na biblioteca.');
  }
  transacao(() => {
    banco.prepare('UPDATE configuracoes SET dados = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = 1')
      .run(JSON.stringify(resultado));
    registrar(usuario, 'Atualizou contatos e configurações', 'configuracoes', 1);
  });
  return resultado;
}

function conteudo(rascunho = false) {
  const registro = banco.prepare('SELECT * FROM conteudos WHERE id = 1').get();
  return JSON.parse(rascunho ? registro.rascunho : registro.publicado).map((item) => {
    if (item.id !== 'como-pedir' || item.passos?.length !== 3) return item;
    const quarto = secoes.find((secao) => secao.id === 'como-pedir').passos[3];
    return { ...item, passos: [...item.passos, { ...quarto }] };
  });
}

function salvarConteudo(entrada, usuario) {
  exigir(Array.isArray(entrada) && entrada.length === secoes.length, 'Mantenha as seções previstas pelo projeto.');
  const usados = new Set();
  const resultado = entrada.map((item) => {
    exigir(secoes.some((secao) => secao.id === item.id) && !usados.has(item.id), 'Seção inválida ou duplicada.');
    usados.add(item.id);
    exigir(!item.imagem_id || imagem(item.imagem_id), 'Selecione uma imagem existente.');
    return {
      id: item.id,
      titulo: texto(item.titulo, 200, 'o título'),
      texto: texto(item.texto, 3000, 'o texto', false),
      chamada: texto(item.chamada, 100, 'a chamada', false),
      visivel: item.visivel !== false,
      posicao: inteiro(item.posicao, 0, 99, 'a posição da seção'),
      imagem_id: item.imagem_id || '',
      passos: item.id === 'como-pedir' ? (item.passos || []).slice(0, 4).map((passo) => ({
        titulo: texto(passo.titulo, 100, 'o título do passo'),
        texto: texto(passo.texto, 1000, 'o texto do passo'),
      })) : [],
    };
  });
  transacao(() => {
    banco.prepare('UPDATE conteudos SET rascunho = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = 1')
      .run(JSON.stringify(resultado));
    registrar(usuario, 'Salvou rascunho da landing page', 'conteudo', 1);
  });
  return resultado;
}

function publicarConteudo(usuario) {
  transacao(() => {
    banco.prepare('UPDATE conteudos SET publicado = rascunho WHERE id = 1').run();
    registrar(usuario, 'Publicou landing page', 'conteudo', 1);
  });
}

function site(rascunho = false) {
  const dados = configuracoes();
  return {
    configuracoes: {
      ...dados,
      favicon: imagem(dados.favicon),
      imagem_compartilhamento: imagem(dados.imagem_compartilhamento),
    },
    secoes: conteudo(rascunho).map((item) => ({ ...item, imagem: imagem(item.imagem_id) })),
  };
}

module.exports = { configuracoes, salvarConfiguracoes, conteudo, salvarConteudo, publicarConteudo, site };
