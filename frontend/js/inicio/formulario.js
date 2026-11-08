import { configuracao, carregarSite } from '../configuracao.js';
import { prepararLinkOrcamento } from '../orcamento/mensagem.js';
import { materiais } from './materiais.js';

export function mensagemContato(dados) {
  return ['Olá! Gostaria de solicitar um orçamento à Gráfica Peregrina.',
    `Nome ou empresa: ${dados.nome}`, `Material: ${dados.material}`,
    `Quantidade: ${Number(dados.quantidade).toLocaleString('pt-BR')} unidades`,
    `Prazo desejado: ${dados.prazo || 'A combinar'}`,
    dados.detalhes ? `Detalhes: ${dados.detalhes}` : '',
    'Podem confirmar as opções, o valor e o prazo de produção?'].filter(Boolean).join('\n\n');
}

export function iniciarFormulario() {
  const form = document.querySelector('#formulario-orcamento');
  const material = form.elements.material;
  for (const nome of [...materiais.map((item) => item.nome), 'Outro material']) {
    const opcao = document.createElement('option');
    opcao.value = nome;
    opcao.textContent = nome;
    material.append(opcao);
  }
  const revisao = document.querySelector('#revisao-contato');
  const mensagem = document.querySelector('#mensagem-contato');
  const estado = document.querySelector('#estado-formulario');
  const abrir = document.querySelector('#abrir-contato-whatsapp');
  function invalidar() {
    revisao.hidden = true;
    abrir.removeAttribute('href');
    estado.textContent = '';
  }
  form.addEventListener('input', invalidar);
  form.addEventListener('change', invalidar);
  document.querySelectorAll('[data-material-orcamento]').forEach((link) => {
    link.addEventListener('click', (evento) => {
      evento.preventDefault();
      material.value = link.dataset.materialOrcamento;
      invalidar();
      document.querySelector('#contato').scrollIntoView({ block: 'start', behavior: 'instant' });
      form.elements.nome.focus({ preventScroll: true });
    });
  });
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!form.reportValidity()) return;
    const dados = Object.fromEntries(new FormData(form));
    const assinatura = JSON.stringify(dados);
    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    estado.textContent = 'Preparando sua mensagem…';
    try {
      await carregarSite(true);
      if (assinatura !== JSON.stringify(Object.fromEntries(new FormData(form)))) return;
      const texto = mensagemContato(dados);
      const destino = prepararLinkOrcamento(configuracao.whatsapp, texto);
      mensagem.value = texto;
      abrir.href = destino.link;
      document.querySelector('#instrucoes-contato').textContent = destino.precisaCopiar
        ? 'Copie o resumo completo e cole na conversa do WhatsApp.'
        : 'Confira o resumo. Você revisa e envia a mensagem no WhatsApp.';
      revisao.hidden = false;
      estado.textContent = '';
      mensagem.focus();
    } catch {
      estado.textContent = 'Não foi possível preparar a mensagem. Tente novamente ou use o contato direto ao lado.';
    } finally { botao.disabled = false; }
  });
  document.querySelector('#copiar-contato').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(mensagem.value);
      estado.textContent = 'Resumo copiado.';
    } catch {
      mensagem.focus();
      mensagem.select();
      estado.textContent = 'Copie o texto selecionado e cole no WhatsApp.';
    }
  });
}
