import { iniciarSessao, requisitar } from './api.js';
import { avisar } from './interface.js';
import * as geral from './geral.js';
import * as catalogo from './catalogo.js';
import * as categorias from './categorias.js';
import * as midias from './midias.js';
import * as conteudo from './conteudo.js';
import * as configuracoes from './configuracoes.js';
import * as equipe from './equipe.js';
import * as contas from './contas.js';
import * as historico from './historico.js';
import * as manual from './manual.js';

const paginas = { geral, catalogo, categorias, midias, conteudo, configuracoes, equipe, contas, historico, manual };
const restritas = new Set(['configuracoes', 'equipe', 'contas', 'historico']);
const container = document.querySelector('#pagina-admin');
let usuario;
let carregamento = 0;

async function navegar() {
  const atual = ++carregamento;
  const [nome = 'geral', parametros = ''] = location.hash.slice(1).split('?');
  if (!paginas[nome]) { location.hash = 'geral'; return; }
  if (restritas.has(nome) && !['administrador', 'criador'].includes(usuario.perfil)) {
    avisar('Esta área está disponível somente para administradores.', true);
    location.hash = 'geral';
    return;
  }
  container.setAttribute('aria-busy', 'true');
  container.textContent = 'Carregando…';
  document.querySelectorAll('.menu-admin a').forEach((link) => {
    if (link.hash === `#${nome}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  try {
    const pagina = document.createElement('div');
    await paginas[nome].montar(pagina, new URLSearchParams(parametros));
    if (atual === carregamento) {
      container.replaceChildren(pagina);
      document.title = `${pagina.querySelector('h1')?.textContent || 'Painel admin'} | Gráfica Peregrina`;
      container.focus({ preventScroll: true });
    }
  } catch (erro) {
    if (atual === carregamento) container.textContent = erro.message;
    avisar(erro.message, true);
  } finally {
    container.setAttribute('aria-busy', 'false');
    document.body.classList.toggle('perfil-editor', usuario.perfil === 'editor');
  }
}

try {
  const acesso = await iniciarSessao();
  usuario = acesso.usuario;
  document.querySelector('#alterar-senha-painel').hidden = usuario.perfil !== 'criador';
  document.querySelector('#pessoa-admin').textContent = `${usuario.nome} · ${usuario.perfil === 'criador' ? 'Criador' : usuario.perfil} · ID: ${usuario.id}`;
  document.querySelector('#estrutura-admin').hidden = false;
  document.querySelector('.pular').addEventListener('click', (evento) => {
    evento.preventDefault();
    container.focus();
  });
  document.body.classList.toggle('perfil-editor', usuario.perfil === 'editor');
  document.querySelector('#sair-admin').addEventListener('click', async () => {
    try { await requisitar('/api/acesso/sair', { method: 'POST' }); location.assign('/'); }
    catch (erro) { avisar(erro.message, true); }
  });
  window.addEventListener('hashchange', navegar);
  await navegar();
} catch (erro) {
  avisar(erro.message, true);
}
