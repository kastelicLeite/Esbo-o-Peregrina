const { exigir } = require('../http/validacao.cjs');

function exigirGestao(usuario, autor) {
  exigir(usuario.id !== 2, 'A conta Criador de ID 2 é protegida.', 403);
  exigir(usuario.perfil !== 'criador' || autor?.perfil === 'criador',
    'Somente um Criador pode gerenciar outra conta Criador.', 403);
}

function exigirPerfil(perfil, autor) {
  exigir(perfil !== 'criador' || autor?.perfil === 'criador',
    'Somente um Criador pode atribuir o perfil Criador.', 403);
}

module.exports = { exigirGestao, exigirPerfil };
