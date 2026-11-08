import { carregarSite } from './configuracao.js';
import { prepararSolicitacao } from './privacidade/solicitacao.js';
import './componentes/conta-cabecalho.js';

const form = document.querySelector('#solicitacao-privacidade');
const estado = document.querySelector('#estado-privacidade');
const botao = form.querySelector('[type="submit"]');
let configuracao;
async function carregar() {
  botao.disabled = true;
  estado.textContent = 'Carregando os canais de atendimento…';
  try {
    const dados = await carregarSite(true);
    configuracao = dados.configuracoes;
    const adicional = document.querySelector('#privacidade-adicional');
    adicional.textContent = configuracao.privacidade || '';
    adicional.hidden = !configuracao.privacidade;
    document.querySelector('#contato-privacidade').textContent = configuracao.contato_privacidade
      || configuracao.email || (configuracao.whatsapp ? `WhatsApp: +${configuracao.whatsapp}` : 'Contato ainda não configurado.');
    estado.textContent = '';
    botao.disabled = false;
    document.querySelector('#recarregar-contato').hidden = true;
  } catch {
    estado.textContent = 'Não foi possível carregar os canais. Tente novamente.';
    document.querySelector('#recarregar-contato').hidden = false;
  }
}

const tipo = new URLSearchParams(location.search).get('solicitacao');
if (['ajuda', 'acesso', 'correcao', 'exclusao'].includes(tipo)) form.elements.tipo.value = tipo;
fetch('/api/conta/sessao', { cache: 'no-store' }).then(async resposta => {
  if (!resposta.ok) return;
  const dados = await resposta.json();
  if (!form.elements.email.value) form.elements.email.value = dados.usuario.email;
}).catch(() => {});

form.addEventListener('submit', evento => {
  evento.preventDefault();
  if (!configuracao) return;
  try {
    const resultado = prepararSolicitacao(Object.fromEntries(new FormData(form)), configuracao);
    document.querySelector('#mensagem-privacidade').value = resultado.mensagem;
    for (const canal of ['email', 'whatsapp']) {
      const link = document.querySelector(`#enviar-privacidade-${canal}`);
      link.hidden = !resultado[canal];
      if (resultado[canal]) link.href = resultado[canal];
      else link.removeAttribute('href');
    }
    document.querySelector('#previa-solicitacao').hidden = false;
    estado.setAttribute('role', 'status');
    estado.textContent = 'Mensagem pronta para conferir. Ela só será enviada quando você enviar no WhatsApp ou no seu aplicativo de e-mail.';
    document.querySelector('#previa-solicitacao').scrollIntoView({ block: 'nearest' });
  } catch (erro) {
    estado.setAttribute('role', 'alert');
    estado.textContent = erro.message;
  }
});
form.addEventListener('input', () => { document.querySelector('#previa-solicitacao').hidden = true; });
document.querySelector('#recarregar-contato').addEventListener('click', carregar);
carregar();
