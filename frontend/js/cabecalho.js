const cabecalho = document.querySelector('.cabecalho');

if (cabecalho) {
  let ultimaPosicao = Math.max(0, window.scrollY);
  let atualizacaoPendente = false;

  function atualizarCabecalho() {
    const posicaoAtual = Math.max(0, window.scrollY);
    const deslocamento = posicaoAtual - ultimaPosicao;

    if (posicaoAtual <= cabecalho.offsetHeight) {
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
