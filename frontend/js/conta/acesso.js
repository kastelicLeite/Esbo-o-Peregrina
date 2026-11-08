import { requisitar } from './api.js';
import { prepararFormulario, prepararSenhas } from './formularios.js';
import { prepararCodigo } from './codigo-recuperacao.js';
import '../componentes/conta-cabecalho.js';

prepararSenhas();
prepararCodigo();
const form = document.querySelector('[data-acesso-cliente]');
const modo = form.dataset.acessoCliente;
const parametros = new URLSearchParams(location.hash.slice(1));
let token = parametros.get('token');
const emailRecuperacao = parametros.get('email');
let desafio;
let permissao;
if (token || emailRecuperacao) history.replaceState(null, '', location.pathname + location.search);

const recuperarSenha = document.querySelector('[data-recuperar-senha]');
if (recuperarSenha) recuperarSenha.addEventListener('click', async (evento) => {
  evento.preventDefault();
  if (recuperarSenha.getAttribute('aria-disabled') === 'true') return;
  const campo = form.elements.email;
  const email = campo.value.trim();
  const aviso = !email ? 'Preencha o e-mail para recuperar sua senha.'
    : campo.validity.typeMismatch || email.length > 180 ? 'Informe um e-mail válido para recuperar sua senha.' : '';
  document.getElementById(`${campo.id}-erro`).textContent = aviso;
  campo.setAttribute('aria-invalid', String(Boolean(aviso)));
  if (aviso) {
    campo.focus();
    return;
  }
  recuperarSenha.setAttribute('aria-disabled', 'true');
  try {
    await requisitar('conferir-email-recuperacao', { email });
    const destino = new URL(recuperarSenha.href);
    destino.hash = new URLSearchParams({ email }).toString();
    location.assign(destino.href);
  } catch (erro) {
    document.getElementById(`${campo.id}-erro`).textContent = erro.message;
    campo.setAttribute('aria-invalid', 'true');
    campo.focus();
  } finally { recuperarSenha.removeAttribute('aria-disabled'); }
});

if (modo === 'recuperacao' && token) {
  document.querySelector('[data-solicitar]').hidden = true;
  document.querySelector('[data-redefinir]').hidden = false;
}

prepararFormulario(form, async (dados, estado) => {
  if (modo === 'entrar') {
    await requisitar('entrar', dados);
    form.reset();
    location.assign('/paginas/produtos.html');
  } else if (modo === 'cadastro') {
    await requisitar('cadastro', dados);
    form.reset();
    location.assign('/paginas/entrar-conta.html');
  } else {
    if (!emailRecuperacao || dados.email.trim() !== emailRecuperacao.trim()) {
      await requisitar('conferir-email-recuperacao', { email: dados.email });
    }
    const resposta = await requisitar('solicitar-codigo', dados);
    desafio = resposta.desafio;
    permissao = null;
    document.querySelector('[data-solicitar]').hidden = true;
    const etapa = document.querySelector('[data-codigo]');
    etapa.hidden = false;
    etapa.querySelector('[data-estado]').textContent = resposta.mensagem;
    etapa.querySelector('[data-digito], input:not([type="hidden"])').focus();
  }
});

const codigo = document.querySelector('[data-codigo] form');
if (codigo) {
  prepararFormulario(codigo, async (dados) => {
    const resposta = await requisitar('validar-codigo', { ...dados, desafio });
    permissao = resposta.permissao;
    desafio = null;
    codigo.reset();
    document.querySelector('[data-codigo]').hidden = true;
    const etapa = document.querySelector('[data-redefinir]');
    etapa.hidden = false;
    etapa.querySelector('[data-estado]').textContent = resposta.mensagem;
    etapa.querySelector('input').focus();
  });
  document.querySelector('[data-novo-codigo]').addEventListener('click', () => {
    desafio = null;
    permissao = null;
    token = null;
    codigo.reset();
    document.querySelector('[data-codigo]').hidden = true;
    document.querySelector('[data-solicitar]').hidden = false;
    form.elements.email.closest('.conta-campo').hidden = false;
    form.querySelector('[data-estado]').textContent = 'Aguarde um minuto desde o último envio antes de solicitar outro código.';
    form.elements.email.focus();
  });
}

const redefinir = document.querySelector('[data-redefinir] form');
if (redefinir) prepararFormulario(redefinir, async (dados, estado) => {
  const rota = permissao ? 'redefinir-com-codigo' : 'redefinir-senha';
  estado.textContent = (await requisitar(rota, { ...dados, token, permissao })).mensagem;
  permissao = null;
  token = null;
  redefinir.reset();
  location.assign('/paginas/entrar-conta.html');
});

if (modo === 'recuperacao' && !token && emailRecuperacao) {
  form.elements.email.value = emailRecuperacao.trim();
  if (form.elements.email.checkValidity() && emailRecuperacao.length <= 180) {
    form.elements.email.closest('.conta-campo').hidden = true;
    document.querySelector('[data-solicitar] > p').textContent = `Vamos enviar o código para ${form.elements.email.value}.`;
    form.requestSubmit();
  }
}
