export function ativarPreviaImagens(cartao, imagem, produto) {
  const fotos = [produto.imagem, ...(produto.galeria || [])].filter(Boolean)
    .filter((item, indice, lista) => lista.findIndex((outra) => outra.id === item.id) === indice);
  if (fotos.length < 2) return;
  let temporizador;
  let indice = 0;

  function mostrar(posicao) {
    const foto = fotos[posicao];
    imagem.src = foto.miniatura || foto.url;
    imagem.alt = foto.alternativo?.trim() || produto.nome;
    imagem.width = foto.largura;
    imagem.height = foto.altura;
  }

  function parar() {
    clearInterval(temporizador);
    temporizador = null;
    indice = 0;
    mostrar(0);
  }

  cartao.addEventListener('pointerenter', (evento) => {
    if (evento.pointerType !== 'mouse' || !window.matchMedia('(hover: hover)').matches
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    parar();
    indice = 1;
    mostrar(indice);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    temporizador = setInterval(() => {
      if (!cartao.isConnected) { parar(); return; }
      if (document.hidden) return;
      indice = (indice + 1) % fotos.length;
      mostrar(indice);
    }, 2500);
  });
  cartao.addEventListener('pointerleave', parar);
  cartao.addEventListener('pointercancel', parar);
}
