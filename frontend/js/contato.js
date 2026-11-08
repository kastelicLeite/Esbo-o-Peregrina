import './componentes/conta-cabecalho.js';
import { carregarSite } from './configuracao.js';
import { avisarAcao } from './componentes/avisos.js';

const form = document.querySelector('#form-contato');
const botao = form.querySelector('[type="submit"]');
const estado = document.querySelector('#estado-contato');
let enviando = false;
let disponivel = false;

async function carregar() {
  botao.disabled = true;
  estado.setAttribute('role', 'status');
  estado.textContent = 'Verificando o atendimento por e-mail…';
  try {
    const [resposta, site] = await Promise.all([
      fetch('/api/contato', { cache: 'no-store' }), carregarSite().catch(() => null),
    ]);
    if (/^\d{10,15}$/.test(site?.configuracoes?.whatsapp || '')) {
      const link = document.querySelector('#contato-whatsapp');
      link.href = `https://wa.me/${site.configuracoes.whatsapp}`;
      link.hidden = false;
    }
    if (!resposta.ok || !(await resposta.json()).disponivel) throw new Error('O contato por e-mail está indisponível no momento. Tente mais tarde ou fale pelo WhatsApp.');
    disponivel = true;
    botao.disabled = false;
    estado.textContent = '';
    document.querySelector('#recarregar-contato').hidden = true;
  } catch (erro) {
    disponivel = false;
    estado.textContent = erro.name === 'Error' ? erro.message : 'Não foi possível carregar o contato. Verifique sua conexão e tente novamente.';
    estado.setAttribute('role', 'alert');
    document.querySelector('#recarregar-contato').hidden = false;
  }
}

const assunto = new URLSearchParams(location.search).get('assunto');
if (['atendimento', 'produto', 'orcamento', 'privacidade', 'outro'].includes(assunto)) form.elements.assunto.value = assunto;
fetch('/api/conta/sessao', { cache: 'no-store' }).then(async resposta => {
  if (!resposta.ok) return;
  const { usuario } = await resposta.json();
  if (!form.elements.nome.value) form.elements.nome.value = usuario.nome;
  if (!form.elements.email.value) form.elements.email.value = usuario.email;
}).catch(() => {});

form.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (enviando || !disponivel) return;
  enviando = true;
  botao.disabled = true;
  botao.textContent = 'Enviando…';
  form.setAttribute('aria-busy', 'true');
  estado.setAttribute('role', 'status');
  estado.textContent = 'Enviando sua mensagem. Aguarde…';
  try {
    const resposta = await fetch('/api/contato', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
      signal: AbortSignal.timeout(30000),
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível confirmar o envio. Tente mais tarde.');
    form.reset();
    estado.textContent = dados.mensagem;
    avisarAcao('Mensagem encaminhada para a equipe!');
  } catch (erro) {
    estado.setAttribute('role', 'alert');
    estado.textContent = erro.name === 'TimeoutError'
      ? 'O envio demorou mais que o esperado. Não foi possível confirmar. Seus campos foram mantidos.'
      : erro.name === 'Error' ? erro.message : 'Não foi possível confirmar o envio. Verifique sua conexão. Seus campos foram mantidos.';
  } finally {
    enviando = false;
    botao.disabled = !disponivel;
    botao.textContent = 'Enviar mensagem';
    form.removeAttribute('aria-busy');
  }
});
document.querySelector('#recarregar-contato').addEventListener('click', carregar);
carregar();
