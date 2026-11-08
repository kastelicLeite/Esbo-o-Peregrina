const link = document.querySelector('[data-conta-cabecalho]');
const paineis = document.querySelectorAll('[data-painel-admin]');
const visitante = document.querySelector('[data-acesso-visitante]');
const contaSimples = document.querySelector('[data-conta-simples]');
let consulta = 0;

function apresentarConta(usuario) {
  paineis.forEach((painel) => { painel.hidden = !['administrador', 'criador'].includes(usuario?.perfil); });
  if (visitante) visitante.hidden = Boolean(usuario);
  if (contaSimples) {
    contaSimples.hidden = !usuario;
    contaSimples.textContent = usuario?.nome || '';
    contaSimples.setAttribute('aria-label', usuario ? `Acessar conta de ${usuario.nome}` : 'Acessar conta');
  }
  if (!link) return;
  link.hidden = !usuario;
  link.dataset.conectado = usuario ? 'sim' : 'nao';
  const rotulo = usuario ? `Acessar conta de ${usuario.nome}` : 'Acessar conta';
  link.querySelector('[data-estado-conta]').textContent = usuario?.nome || '';
  link.setAttribute('aria-label', rotulo);
  link.title = usuario?.nome || rotulo;
}

async function atualizarConta() {
  if (!link && !paineis.length) return;
  const atual = ++consulta;
  try {
    const resposta = await fetch('/api/conta/sessao', {
      credentials: 'same-origin', cache: 'no-store',
    });
    if (atual !== consulta) return;
    if (!resposta.ok) {
      if (resposta.status !== 401) return;
      apresentarConta(null);
      return;
    }
    const { usuario } = await resposta.json();
    if (atual !== consulta || !usuario?.nome) return;
    apresentarConta(usuario);
  } catch {
    // O acesso à conta continua disponível quando a consulta falha.
  }
}

atualizarConta();
window.addEventListener('focus', atualizarConta);
window.addEventListener('pageshow', (evento) => {
  if (evento.persisted) atualizarConta();
});
