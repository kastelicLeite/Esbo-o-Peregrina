import { requisitar } from './api.js';
import { prepararFormulario, prepararSenhas } from './formularios.js';
import '../componentes/conta-cabecalho.js';
import { avisarAcao } from '../componentes/avisos.js';

const estado = document.querySelector('#estado-conta');
const conteudo = document.querySelector('#dados-conta');
prepararSenhas();

function mostrarDados(usuario) {
  document.querySelector('#nome-conta').value = usuario.nome;
  document.querySelector('#nome-resumo-conta').textContent = usuario.nome;
  document.querySelector('#id-conta').textContent = usuario.id;
  document.querySelector('#email-conta').textContent = usuario.email;
}

try {
  const { usuario } = await requisitar('sessao');
  mostrarDados(usuario);
  conteudo.hidden = false;
  estado.textContent = '';
} catch (erro) {
  if (erro.status === 401) location.replace('/paginas/entrar-conta.html');
  else if (erro.status === 403) {
    estado.textContent = '';
    location.replace('/paginas/entrar-conta.html');
  } else estado.textContent = erro.message;
}

prepararFormulario(document.querySelector('#editar-nome'), async (dados, mensagem) => {
  const { usuario } = await requisitar('nome', dados, 'PATCH');
  mostrarDados(usuario);
  mensagem.textContent = 'Nome atualizado.';
  avisarAcao('Seu nome foi atualizado.');
});

prepararFormulario(document.querySelector('#alterar-senha'), async (dados, mensagem) => {
  mensagem.textContent = (await requisitar('senha', dados, 'PUT')).mensagem;
  document.querySelector('#alterar-senha').reset();
  conteudo.querySelectorAll('form input, form button, #sair-conta').forEach((campo) => { campo.disabled = true; });
  document.querySelector('#alterar-senha [type="submit"]').hidden = true;
  document.querySelector('#entrar-novamente').hidden = false;
});

document.querySelector('#sair-conta').addEventListener('click', async (evento) => {
  evento.currentTarget.disabled = true;
  try {
    await requisitar('sair', {});
    location.assign('/paginas/entrar-conta.html');
  } catch (erro) {
    estado.textContent = erro.message;
    evento.target.disabled = false;
  }
});
