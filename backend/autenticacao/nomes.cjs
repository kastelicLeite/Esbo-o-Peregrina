const { banco } = require('../dados/banco.cjs');
const { texto, exigir } = require('../http/validacao.cjs');

function normalizarNome(valor) {
  return typeof valor === 'string' ? valor.normalize('NFKC').trim().replace(/\s+/gu, ' ') : valor;
}

function validarNome(valor, idAtual = null) {
  const nome = texto(normalizarNome(valor), 100, 'o nome');
  const chave = nome.toLocaleLowerCase('pt-BR');
  const repetido = banco.prepare('SELECT id, nome FROM usuarios').all().some((usuario) =>
    usuario.id !== idAtual && normalizarNome(usuario.nome).toLocaleLowerCase('pt-BR') === chave);
  exigir(!repetido, 'Este nome já está em uso. Escolha outro.', 409);
  return nome;
}

module.exports = { validarNome };
