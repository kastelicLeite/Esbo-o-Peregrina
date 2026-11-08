import './busca-cabecalho.js';
import './orcamento/cabecalho.js';
import './componentes/conta-cabecalho.js';
import './componentes/categorias-cabecalho.js';

const cabecalho = document.querySelector('.cabecalho');

if (cabecalho) {
  const menu = cabecalho.querySelector('#menu-cabecalho');
  if (!menu.querySelector('[data-recomendados]')) {
    const recomendados = document.createElement('a');
    recomendados.href = '/paginas/recomendados.html';
    recomendados.dataset.recomendados = '';
    recomendados.textContent = 'Recomendados';
    menu.insertBefore(recomendados, menu.querySelector('.sobre-cabecalho'));
  }
  const botaoMenu = cabecalho.querySelector('.menu-cabecalho-botao');
  const telaPequena = window.matchMedia('(max-width: 760px)');
  let ultimaPosicao = Math.max(0, window.scrollY);
  let atualizacaoPendente = false;

  function definirMenu(aberto) {
    cabecalho.dataset.menuAberto = aberto ? 'sim' : 'nao';
    botaoMenu.setAttribute('aria-expanded', String(aberto));
    botaoMenu.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    botaoMenu.querySelector('path').setAttribute('d', aberto
      ? 'M6 6l12 12M18 6 6 18' : 'M4 6h16M4 12h16M4 18h16');
  }

  function fecharMenu(devolverFoco = false) {
    definirMenu(false);
    const categorias = menu.querySelector('.categorias-cabecalho');
    if (categorias) categorias.open = false;
    if (devolverFoco) botaoMenu.focus();
  }

  botaoMenu.hidden = false;
  cabecalho.addEventListener('focusin', () => cabecalho.classList.remove('cabecalho-oculto'));
  cabecalho.classList.add('cabecalho-com-menu');
  botaoMenu.addEventListener('click', () => {
    const abrir = botaoMenu.getAttribute('aria-expanded') !== 'true';
    definirMenu(abrir);
  });
  cabecalho.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && cabecalho.dataset.menuAberto === 'sim') {
      evento.preventDefault();
      fecharMenu(true);
    }
  });
  menu.addEventListener('click', (evento) => {
    const link = evento.target.closest('a');
    if (!link || !telaPequena.matches) return;
    fecharMenu();
    const endereco = new URL(link.href);
    if (endereco.pathname === location.pathname && endereco.hash) {
      const destino = document.getElementById(endereco.hash.slice(1));
      if (destino) requestAnimationFrame(() => {
        if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
        destino.focus({ preventScroll: true });
      });
    }
  });
  cabecalho.querySelector('.busca-cabecalho').addEventListener('focusin', () => fecharMenu());
  document.addEventListener('pointerdown', (evento) => {
    if (!cabecalho.contains(evento.target)) fecharMenu();
  });
  cabecalho.addEventListener('focusout', (evento) => {
    if (!cabecalho.contains(evento.relatedTarget)) fecharMenu();
  });
  telaPequena.addEventListener('change', () => fecharMenu());

  function atualizarNavegacao() {
    const pagina = location.pathname;
    const inicio = ['/', '/index.html', '/paginas/index.html'].includes(pagina);
    const catalogo = pagina === '/paginas/produtos.html' || pagina === '/paginas/produto.html'
      || pagina.startsWith('/produtos/');
    for (const link of menu.querySelectorAll(':scope > a:not([data-painel-admin])')) {
      const destino = new URL(link.href);
      const ativo = destino.hash ? inicio && location.hash === destino.hash
        : destino.pathname === '/' ? inicio && (!location.hash || location.hash === '#inicio')
          : destino.pathname === '/paginas/produtos.html' ? catalogo : destino.pathname === pagina;
      if (ativo) link.setAttribute('aria-current', destino.hash ? 'location' : 'page');
      else link.removeAttribute('aria-current');
    }
    const carrinho = cabecalho.querySelector('.acesso-orcamento');
    if (pagina === '/paginas/orcamento.html') carrinho.setAttribute('aria-current', 'page');
    else carrinho.removeAttribute('aria-current');
  }

  atualizarNavegacao();
  window.addEventListener('hashchange', atualizarNavegacao);

  function atualizarCabecalho() {
    const posicaoAtual = Math.max(0, window.scrollY);
    const deslocamento = posicaoAtual - ultimaPosicao;

    if (posicaoAtual <= cabecalho.offsetHeight || cabecalho.contains(document.activeElement)
      || cabecalho.dataset.menuAberto === 'sim') {
      cabecalho.classList.remove('cabecalho-oculto');
      ultimaPosicao = posicaoAtual;
    } else if (Math.abs(deslocamento) >= 8) {
      cabecalho.classList.toggle('cabecalho-oculto', deslocamento > 0);
      ultimaPosicao = posicaoAtual;
    }

    atualizacaoPendente = false;
  }

  function medirCabecalho() {
    document.documentElement.style.setProperty(
      '--altura-cabecalho',
      `${cabecalho.offsetHeight}px`,
    );
  }

  window.addEventListener('scroll', () => {
    if (!atualizacaoPendente) {
      atualizacaoPendente = true;
      window.requestAnimationFrame(atualizarCabecalho);
    }
  }, { passive: true });

  new ResizeObserver(medirCabecalho).observe(cabecalho);
  medirCabecalho();
}
