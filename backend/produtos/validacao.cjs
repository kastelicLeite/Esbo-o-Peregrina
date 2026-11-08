const { randomUUID } = require('node:crypto');
const { exigir, texto, inteiro, dinheiro, slug } = require('../http/validacao.cjs');

function validarCaracteristicas(entrada) {
  exigir(Array.isArray(entrada) && entrada.length <= 20, 'Use até 20 características por produto.');
  const identificadores = new Set();

  return entrada.map((item) => {
    const id = item.id || randomUUID();
    exigir(typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id)
      && !identificadores.has(id), 'Identificador de característica duplicado ou inválido.');
    identificadores.add(id);
    exigir(['fixa', 'selecao'].includes(item.tipo), 'Escolha característica fixa ou selecionável.');
    exigir(Array.isArray(item.valores) && item.valores.length <= 50, 'Use até 50 valores por característica.');
    const ids = new Set();
    const nomes = new Set();
    const valores = item.valores.map((valor) => {
      const valorId = valor.id || randomUUID();
      const nome = texto(valor.nome, 100, 'o valor da característica');
      exigir(/^[a-zA-Z0-9-]{1,80}$/.test(valorId) && !ids.has(valorId)
        && !nomes.has(nome.toLowerCase()), 'Há valores repetidos na característica.');
      ids.add(valorId);
      nomes.add(nome.toLowerCase());
      return { id: valorId, nome, ativo: valor.ativo !== false,
        imagem_id: valor.imagem_id ? texto(valor.imagem_id, 80, 'a imagem da opção') : null };
    });

    return {
      id,
      nome: texto(item.nome, 100, 'o nome da característica'),
      tipo: item.tipo,
      ativo: item.ativo !== false,
      valor: texto(item.valor || '', 200, 'o valor fixo', false),
      valores,
    };
  });
}

function validarProduto(dados) {
  exigir(dados && typeof dados === 'object', 'Informe os dados do produto.');
  exigir(['orcamento', 'preco'].includes(dados.comercial), 'Escolha a apresentação comercial.');
  exigir(Array.isArray(dados.galeria) && dados.galeria.length <= 20, 'Use até 20 imagens na galeria.');
  const galeria = dados.galeria.map((id) => texto(id, 80, 'a imagem'));
  exigir(new Set(galeria).size === galeria.length, 'Não repita imagens na galeria.');
  exigir(Array.isArray(dados.tiragens) && dados.tiragens.length <= 50, 'Use até 50 tiragens.');
  const tiragens = dados.tiragens.map((valor) => inteiro(valor, 1, 10000000, 'a tiragem'));
  exigir(new Set(tiragens).size === tiragens.length, 'Não repita tiragens.');

  return {
    nome: texto(dados.nome, 150, 'o nome'),
    descricao: texto(dados.descricao || '', 3000, 'a descrição', false),
    slug: dados.slug ? slug(dados.slug) : '',
    categoria_id: dados.categoria_id ? inteiro(dados.categoria_id, 1, Number.MAX_SAFE_INTEGER, 'a categoria') : null,
    destaque: dados.destaque ? 1 : 0,
    posicao: inteiro(dados.posicao ?? 0, 0, 99999, 'a posição'),
    comercial: dados.comercial,
    estoque: validarEstoque(dados.estoque),
    imagem_id: dados.imagem_id ? texto(dados.imagem_id, 80, 'a imagem principal') : null,
    galeria,
    caracteristicas: validarCaracteristicas(dados.caracteristicas || []),
    tiragens,
  };
}

function validarEstoque(entrada) {
  if (entrada === null || entrada === undefined || entrada === '') return null;
  exigir(typeof entrada === 'number' || (typeof entrada === 'string' && /^\d+$/.test(entrada)),
    'Informe o estoque em unidades inteiras ou deixe vazio para não controlar.');
  return inteiro(entrada, 0, 10000000, 'o estoque: de 0 a 10.000.000 unidades');
}

function validarVariacoes(entrada, produto) {
  exigir(Array.isArray(entrada) && entrada.length <= 500, 'Use até 500 combinações cadastradas manualmente.');
  const assinaturas = new Set();
  return entrada.map((item) => {
    exigir(item.opcoes && typeof item.opcoes === 'object' && !Array.isArray(item.opcoes), 'Confira as opções da combinação.');
    const opcoes = {};
    for (const chave of Object.keys(item.opcoes).sort()) {
      const atributo = produto.caracteristicas.find((campo) => campo.id === chave);
      exigir(atributo?.tipo === 'selecao', 'A combinação contém uma característica inexistente.');
      const valor = atributo.valores.find((campo) => campo.id === item.opcoes[chave]);
      exigir(valor, 'A combinação contém um valor inexistente.');
      opcoes[chave] = valor.id;
    }
    const quantidade = inteiro(item.quantidade, 1, 10000000, 'a quantidade');
    const assinatura = JSON.stringify(opcoes);
    const chave = `${assinatura}:${quantidade}`;
    exigir(!assinaturas.has(chave), 'Há combinações de opções e tiragem repetidas.');
    assinaturas.add(chave);

    return {
      id: item.id ? inteiro(item.id, 1, Number.MAX_SAFE_INTEGER, 'a combinação') : null,
      opcoes,
      assinatura,
      quantidade,
      total_centavos: dinheiro(item.total),
      unitario_centavos: dinheiro(item.unitario),
      aproximado: item.aproximado ? 1 : 0,
      codigo: texto(item.codigo || '', 100, 'o código interno', false),
      disponivel: item.disponivel !== false ? 1 : 0,
      ativa: item.ativa !== false ? 1 : 0,
    };
  });
}

function combinacaoValida(variacao, produto) {
  if (!variacao.ativa || !variacao.disponivel || !produto.tiragens.includes(variacao.quantidade)) return false;
  const selecionaveis = produto.caracteristicas.filter((item) => item.ativo && item.tipo === 'selecao');
  if (Object.keys(variacao.opcoes).length !== selecionaveis.length) return false;
  return selecionaveis.every((item) => item.valores.some((valor) => valor.ativo
    && valor.id === variacao.opcoes[item.id]));
}

module.exports = { validarProduto, validarVariacoes, combinacaoValida, validarEstoque };
