import { carrinho } from './estado.js';

function atualizarContador() {
  document.querySelectorAll('[data-contador-orcamento]').forEach((node) => {
    const total = carrinho.ler().length;
    node.textContent = String(total);
    node.closest('.acesso-orcamento')?.setAttribute('aria-label',
      `Meu carrinho, ${total} ${total === 1 ? 'item' : 'itens'}`);
  });
}

atualizarContador();
window.addEventListener('orcamento-alterado', atualizarContador);
window.addEventListener('pageshow', () => { carrinho.restaurar(); atualizarContador(); });
