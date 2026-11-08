const express = require('express');
const { listarPublicos } = require('./servico.cjs');
const { exigir } = require('../http/validacao.cjs');

function mesmasOpcoes(a, b) {
  const chaves = Object.keys(a);
  return chaves.length === Object.keys(b).length && chaves.every((chave) => a[chave] === b[chave]);
}

function validarOrcamento(entrada, catalogo = listarPublicos()) {
  exigir(Array.isArray(entrada) && entrada.length <= 50, 'Use até 50 configurações por orçamento.');
  const produtos = new Map(catalogo.map((produto) => [produto.id, produto]));
  const itens = entrada.map((item) => {
    const invalido = (motivo) => ({ id: item?.id, produto_id: item?.produto_id, disponivel: false, motivo });
    if (!item || !Number.isSafeInteger(item.produto_id)) return invalido('Produto inválido.');
    const produto = produtos.get(item.produto_id);
    if (!produto) return invalido('Este produto não está mais disponível no catálogo.');
    const base = { id: item.id, produto_id: produto.id, nome: produto.nome, slug: produto.slug,
      imagem: produto.imagem, disponivel: false };
    if (!item.opcoes || typeof item.opcoes !== 'object' || Array.isArray(item.opcoes)) {
      return { ...base, motivo: 'Escolha novamente as opções deste produto.' };
    }
    const campos = produto.caracteristicas.filter((campo) => campo.tipo === 'selecao');
    if (Object.keys(item.opcoes).length !== campos.length || !campos.every((campo) =>
      campo.valores.some((valor) => valor.id === item.opcoes[campo.id]))) {
      return { ...base, motivo: 'Uma das opções mudou. Edite este item para escolher novamente.' };
    }
    const candidatas = produto.variacoes.filter((variacao) => mesmasOpcoes(variacao.opcoes, item.opcoes));
    if (!candidatas.length) return { ...base, motivo: 'Esta combinação não está mais disponível.' };
    if (!Number.isSafeInteger(item.quantidade) || !produto.tiragens.includes(item.quantidade)) {
      return { ...base, motivo: 'Escolha uma quantidade disponível para este produto.' };
    }
    const variacao = candidatas.find((opcao) => opcao.quantidade === item.quantidade);
    const especificacoes = produto.caracteristicas.map((campo) => ({
      nome: campo.nome,
      valor: campo.tipo === 'fixa' ? campo.valor : campo.valores.find((valor) => valor.id === item.opcoes[campo.id]).nome,
    }));
    const imagemOpcao = campos.map((campo) => campo.valores.find((valor) => valor.id === item.opcoes[campo.id])?.imagem).find(Boolean);
    return { ...base, imagem: imagemOpcao || base.imagem, disponivel: true, quantidade: item.quantidade, opcoes: item.opcoes, especificacoes,
      total_centavos: produto.comercial === 'preco' ? variacao?.total_centavos ?? null : null,
      unitario_centavos: produto.comercial === 'preco' ? variacao?.unitario_centavos ?? null : null,
      aproximado: Boolean(variacao?.aproximado) };
  });
  const validos = itens.filter((item) => item.disponivel);
  const precificados = validos.filter((item) => item.total_centavos !== null);
  const subtotal = precificados.reduce((total, item) => total + BigInt(item.total_centavos), 0n);
  exigir(subtotal <= BigInt(Number.MAX_SAFE_INTEGER), 'O orçamento ultrapassa o limite de valor suportado.');
  return { itens, subtotal_centavos: Number(subtotal), com_preco: precificados.length,
    sob_orcamento: validos.length - precificados.length,
    pode_enviar: itens.length > 0 && validos.length === itens.length };
}

const router = express.Router();
router.post('/validar', (pedido, resposta) => resposta.json(validarOrcamento(pedido.body?.itens)));

module.exports = { router, validarOrcamento };
