let temporizador;

export function avisarAcao(texto, opcoes = {}) {
  let aviso = document.querySelector('#aviso-publico');
  if (!aviso) {
    aviso = document.createElement('aside');
    aviso.id = 'aviso-publico';
    aviso.className = 'aviso-publico';
    aviso.setAttribute('aria-label', 'Aviso do site');
    document.body.append(aviso);
    aviso.addEventListener('focusin', () => clearTimeout(temporizador));
    aviso.addEventListener('mouseenter', () => clearTimeout(temporizador));
  }
  clearTimeout(temporizador);
  aviso.replaceChildren();
  aviso.hidden = false;
  aviso.classList.toggle('aviso-publico-erro', Boolean(opcoes.erro));
  const mensagem = document.createElement('p');
  mensagem.setAttribute('role', opcoes.erro ? 'alert' : 'status');
  mensagem.textContent = texto;
  aviso.append(mensagem);
  if (opcoes.carrinho) {
    const link = document.createElement('a');
    link.href = '/paginas/orcamento.html';
    link.textContent = 'Ver meu carrinho →';
    aviso.append(link);
  }
  const fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.setAttribute('aria-label', 'Fechar aviso');
  fechar.textContent = '×';
  fechar.addEventListener('click', () => { aviso.hidden = true; clearTimeout(temporizador); });
  aviso.append(fechar);
  if (!opcoes.erro) temporizador = setTimeout(() => { aviso.hidden = true; }, 8000);
}
