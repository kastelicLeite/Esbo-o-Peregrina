export function montarGaleria(destino, imagens) {
  if (!imagens.length) return () => {};
  const palco = document.createElement('div');
  palco.className = 'palco-galeria';
  palco.setAttribute('role', 'region');
  palco.setAttribute('aria-label', 'Imagens do produto');
  const principal = document.createElement('img');
  principal.className = 'foto-detalhe';
  principal.decoding = 'async';
  palco.append(principal);
  const miniaturas = document.createElement('div');
  miniaturas.className = 'miniaturas-produto';
  miniaturas.setAttribute('aria-label', 'Escolher imagem do produto');
  let atual = 0;
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pausado = movimentoReduzido.matches;
  let ponteiroDentro = false;
  let ultimoAvanco = Date.now();
  const botoes = [];
  const contador = document.createElement('span');
  contador.className = 'contador-galeria';

  function mostrar(indice) {
    atual = (indice + imagens.length) % imagens.length;
    const imagem = imagens[atual];
    principal.src = imagem.url;
    principal.alt = imagem.alternativo?.trim() || `Imagem ${atual + 1} do produto`;
    principal.width = imagem.largura;
    principal.height = imagem.altura;
    contador.textContent = `${atual + 1} / ${imagens.length}`;
    botoes.forEach((botao, i) => botao.setAttribute('aria-pressed', String(i === atual)));
    const escolhido = botoes[atual];
    if (escolhido) {
      const inicio = escolhido.offsetLeft - miniaturas.offsetLeft;
      if (inicio < miniaturas.scrollLeft) miniaturas.scrollLeft = inicio;
      else if (inicio + escolhido.offsetWidth > miniaturas.scrollLeft + miniaturas.clientWidth) {
        miniaturas.scrollLeft = inicio + escolhido.offsetWidth - miniaturas.clientWidth;
      }
    }
    ultimoAvanco = Date.now();
  }

  imagens.forEach((imagem, indice) => {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.setAttribute('aria-label', `Ver imagem ${indice + 1}${imagem.alternativo?.trim() ? `: ${imagem.alternativo}` : ''}`);
    botao.addEventListener('click', () => mostrar(indice));
    const img = document.createElement('img');
    img.src = imagem.miniatura;
    img.alt = '';
    img.loading = 'lazy';
    img.width = 64;
    img.height = 64;
    botao.append(img);
    botoes.push(botao);
    miniaturas.append(botao);
  });
  destino.append(palco);
  let pausar;
  const atualizarPausa = () => {
    if (!pausar) return;
    pausar.textContent = pausado ? 'Retomar troca de fotos' : 'Pausar troca de fotos';
  };
  const reduzirMovimento = () => {
    if (movimentoReduzido.matches) { pausado = true; atualizarPausa(); }
  };
  if (imagens.length > 1) {
    for (const [passo, texto, rotulo] of [[-1, '‹', 'Imagem anterior'], [1, '›', 'Próxima imagem']]) {
      const seta = document.createElement('button');
      seta.type = 'button';
      seta.className = `seta-galeria ${passo < 0 ? 'seta-anterior' : 'seta-proxima'}`;
      seta.textContent = texto;
      seta.setAttribute('aria-label', rotulo);
      seta.addEventListener('click', () => mostrar(atual + passo));
      palco.append(seta);
    }
    const controle = document.createElement('div');
    controle.className = 'controle-galeria';
    pausar = document.createElement('button');
    pausar.type = 'button';
    pausar.className = 'botao-admin';
    pausar.addEventListener('click', () => {
      pausado = !pausado;
      ultimoAvanco = Date.now();
      atualizarPausa();
    });
    atualizarPausa();
    controle.append(contador, pausar);
    destino.append(miniaturas, controle);
  }
  destino.addEventListener('keydown', (evento) => {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault();
    mostrar(atual + (evento.key === 'ArrowLeft' ? -1 : 1));
  });
  destino.addEventListener('mouseenter', () => { ponteiroDentro = true; });
  destino.addEventListener('mouseleave', () => { ponteiroDentro = false; ultimoAvanco = Date.now(); });
  mostrar(0);
  movimentoReduzido.addEventListener('change', reduzirMovimento);
  const temporizador = imagens.length > 1 ? setInterval(() => {
    if (!destino.isConnected) { limpar(); return; }
    if (!pausado && !ponteiroDentro && !document.hidden && !destino.contains(document.activeElement)
      && Date.now() - ultimoAvanco >= 8000) mostrar(atual + 1);
  }, 1000) : null;
  function limpar() {
    clearInterval(temporizador);
    movimentoReduzido.removeEventListener('change', reduzirMovimento);
  }
  return limpar;
}
