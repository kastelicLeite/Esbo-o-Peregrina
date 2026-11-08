import { elemento } from './interface.js';

export function usarIcone(botao, tipo, rotulo) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const caminhos = tipo === 'excluir'
    ? ['M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7']
    : tipo === 'editar' ? ['M16 3a2.1 2.1 0 0 1 3 3L8 17l-5 1 1-5L16 3M14 5l3 3M3 21h18']
      : tipo === 'restaurar' ? ['M3 5v5h5M3 10a9 9 0 1 1 1 8']
      : ['M3 3h18v5H3zM5 8v13h14V8M9 12h6'];
  for (const d of caminhos) {
    const caminho = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    caminho.setAttribute('d', d);
    svg.append(caminho);
  }
  botao.replaceChildren(svg);
  botao.title = rotulo;
  botao.setAttribute('aria-label', rotulo);
  botao.classList.add('acao-produto-icone');
  return botao;
}

export function menuAcoesProduto(nome, acoes) {
  const abrir = elemento('button', {
    type: 'button', className: 'abrir-acoes-produto', title: `Ações de ${nome}`,
    'aria-label': `Ações de ${nome}`, 'aria-expanded': 'false',
  }, '⋯');
  const painel = elemento('div', { className: 'menu-acoes-produto', popover: 'auto', id: `acoes-${crypto.randomUUID()}` }, acoes);
  abrir.setAttribute('aria-controls', painel.id);
  abrir.addEventListener('click', (evento) => {
    painel.togglePopover();
    if (!painel.matches(':popover-open')) return;
    const origem = abrir.getBoundingClientRect();
    const altura = painel.getBoundingClientRect().height;
    painel.style.left = `${Math.max(8, Math.min(origem.right - 200, window.innerWidth - 208))}px`;
    painel.style.top = `${Math.max(8, Math.min(origem.bottom + 6, window.innerHeight - altura - 8))}px`;
    if (evento.detail === 0) painel.querySelector('button:not(:disabled), a[href]')?.focus();
  });
  painel.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      painel.hidePopover();
      abrir.focus();
    }
  });
  painel.addEventListener('toggle', (evento) => abrir.setAttribute('aria-expanded', String(evento.newState === 'open')));
  painel.addEventListener('click', (evento) => {
    if (evento.target.closest('button, a')) painel.hidePopover();
  });
  return elemento('div', { className: 'acoes-produto-compactas' }, [abrir, painel]);
}
