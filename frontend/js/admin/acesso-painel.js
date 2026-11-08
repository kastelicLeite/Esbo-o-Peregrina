import { prepararSenhas } from '../conta/formularios.js';

const form = document.querySelector('#senha-painel');
const estado = document.querySelector('#estado-acesso');
const orientacao = document.querySelector('#orientacao-acesso');
const enviar = document.querySelector('#confirmar-acesso');
let csrf;
let configurar = false;
const tabelas = new URLSearchParams(location.search).get('destino') === 'banco';
prepararSenhas();

async function carregar() {
  const resposta = await fetch('/api/painel/acesso', { cache: 'no-store' });
  if (resposta.status === 401) {
    location.replace('/paginas/entrar-conta.html');
    return;
  }
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro);
  csrf = dados.csrf;
  const alterar = new URLSearchParams(location.search).get('alterar') === '1';
  configurar = !dados.configurada || (alterar && dados.pode_configurar);
  if (dados.liberado && !configurar && !tabelas) {
    location.replace('/paginas/painel-admin.html');
    return;
  }
  if (alterar && dados.configurada && !dados.liberado) {
    orientacao.textContent = 'Informe a senha atual para desbloquear o painel. Depois, abra novamente a alteração de senha.';
    configurar = false;
  } else if (configurar) {
    if (!dados.pode_configurar) {
      orientacao.textContent = 'O Criador precisa definir a senha compartilhada antes de liberar o painel. Peça ajuda ao responsável.';
      return;
    }
    orientacao.textContent = 'Defina uma senha compartilhada para a equipe, diferente da sua senha pessoal. Use pelo menos 12 caracteres, com letras e números.';
    document.querySelector('#rotulo-senha-painel').textContent = 'Nova senha do painel';
    document.querySelector('#campo-confirmacao-painel').hidden = false;
    form.elements.confirmacao.required = true;
    form.elements.senha.minLength = 12;
    form.elements.senha.autocomplete = 'new-password';
    if (dados.configurada) {
      document.querySelector('#campo-senha-atual').hidden = false;
      form.elements.senha_atual.required = true;
      document.querySelector('#voltar-painel').hidden = false;
    }
    enviar.textContent = dados.configurada ? 'Alterar senha do painel' : 'Definir senha e entrar';
  } else orientacao.textContent = tabelas
    ? 'Confirme a senha compartilhada do painel para consultar as tabelas do banco. A liberação dura 15 minutos nesta sessão.'
    : 'Sua conta já está conectada. Informe a senha compartilhada da equipe para liberar o painel por duas horas nesta sessão.';
  if (tabelas && !configurar) {
    document.querySelector('#titulo-acesso').textContent = 'Acesso às tabelas do banco';
    enviar.textContent = 'Confirmar e ver tabelas';
  }
  form.hidden = false;
  form.elements.senha.focus();
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!form.reportValidity()) return;
  if (configurar && form.elements.senha.value !== form.elements.confirmacao.value) {
    estado.textContent = 'As senhas não coincidem.';
    form.elements.confirmacao.focus();
    return;
  }
  enviar.disabled = true;
  estado.textContent = 'Conferindo…';
  try {
    const resposta = await fetch('/api/painel/acesso', {
      method: configurar ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), ...(tabelas ? { destino: 'banco' } : {}) }),
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro);
    form.reset();
    location.replace(tabelas ? (configurar ? '/paginas/acesso-painel.html?destino=banco' : '/admin/banco') : '/paginas/painel-admin.html');
  } catch (erro) { estado.textContent = erro.message; }
  finally { enviar.disabled = false; }
});

carregar().catch((erro) => { estado.textContent = erro.message; });
