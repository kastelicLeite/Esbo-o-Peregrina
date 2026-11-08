import { requisitar } from './api.js';

export async function montar(container, parametros) {
  const { html } = await requisitar('/api/admin/manual');
  container.innerHTML = html;

  function irPara(secao) {
    const destino = container.querySelector(`#manual-${CSS.escape(secao)}`);
    if (!destino || !container.isConnected) return;
    destino.focus({ preventScroll: true });
    destino.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  container.querySelectorAll('[data-secao-manual]').forEach((link) => {
    link.addEventListener('click', (evento) => {
      evento.preventDefault();
      const secao = link.dataset.secaoManual;
      history.replaceState(null, '', `#manual?secao=${encodeURIComponent(secao)}`);
      irPara(secao);
    });
  });
  if (parametros.get('secao')) requestAnimationFrame(() => irPara(parametros.get('secao')));
}
