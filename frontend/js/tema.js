(() => {
  const raiz = document.documentElement;
  function lerPreferencia() {
    try {
      return (localStorage.getItem('peregrina-tema') || localStorage.getItem('peregrina-tema-conta')) === 'escuro' ? 'escuro' : 'claro';
    } catch { return 'claro'; }
  }

  function aplicarTema(tema, salvar = false) {
    if (!['claro', 'escuro'].includes(tema)) return;
    raiz.dataset.tema = tema;
    document.querySelectorAll('[data-definir-tema]').forEach(botao => {
      botao.setAttribute('aria-pressed', String(botao.dataset.definirTema === tema));
    });
    const alternar = document.querySelector('[data-alternar-tema]');
    if (alternar) alternar.setAttribute('aria-pressed', String(tema === 'escuro'));
    if (!salvar) return;
    const estado = document.querySelector('#estado-tema');
    try {
      localStorage.setItem('peregrina-tema', tema);
      if (estado) estado.textContent = `Tema ${tema} selecionado.`;
    } catch {
      if (estado) estado.textContent = 'Tema aplicado. Não foi possível salvar a preferência neste navegador.';
    }
  }

  aplicarTema(lerPreferencia());

  document.addEventListener('DOMContentLoaded', () => {
    const botao = document.querySelector('[data-alternar-tema]');
    if (botao) {
      botao.hidden = false;
      botao.addEventListener('click', () => aplicarTema(raiz.dataset.tema === 'escuro' ? 'claro' : 'escuro', true));
    }
    const opcoes = [...document.querySelectorAll('[data-definir-tema]')];
    opcoes.forEach((opcao, indice) => {
      opcao.addEventListener('click', () => aplicarTema(opcao.dataset.definirTema, true));
      opcao.addEventListener('keydown', evento => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
        evento.preventDefault();
        const destino = evento.key === 'Home' ? 0 : evento.key === 'End' ? opcoes.length - 1
          : (indice + (evento.key === 'ArrowRight' ? 1 : -1) + opcoes.length) % opcoes.length;
        opcoes[destino].focus();
        aplicarTema(opcoes[destino].dataset.definirTema, true);
      });
    });
    aplicarTema(raiz.dataset.tema);
  });
  window.addEventListener('storage', evento => {
    if (evento.key === null || ['peregrina-tema', 'peregrina-tema-conta'].includes(evento.key)) aplicarTema(lerPreferencia());
  });
})();
