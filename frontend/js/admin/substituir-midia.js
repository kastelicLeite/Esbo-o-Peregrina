import { requisitar } from './api.js';
import { elemento, campo, dialogo, enviar, avisar } from './interface.js';

export function substituirMidia(imagem, aoSubstituir) {
  const previa = elemento('img', { src: imagem.miniatura_url, alt: imagem.alternativo || imagem.nome,
    width: 160, height: 160, className: 'previa-substituicao-midia' });
  const arquivo = campo('Nova imagem', 'imagem', '', 'file');
  const entrada = arquivo.querySelector('input');
  entrada.accept = 'image/jpeg,image/png,image/webp,image/avif';
  const origem = campo('Como substituir?', 'origem', 'arquivo', 'select', [
    { valor: 'arquivo', nome: 'Escolher arquivo do computador' },
    { valor: 'colar', nome: 'Colar imagem copiada' },
    { valor: 'link', nome: 'Usar link da imagem' },
  ]);
  const link = campo('Link direto da imagem', 'url', '', 'url', [],
    'Use um link público HTTPS do arquivo. A imagem será baixada e validada ao confirmar.');
  const areaColar = elemento('div', { className: 'area-colar-imagem', tabIndex: 0 }, [
    elemento('p', {}, 'Clique aqui e cole uma imagem com Ctrl + V (ou ⌘ + V no Mac). Cole novamente para trocar a imagem antes de confirmar.'),
  ]);
  const estado = elemento('p', { role: 'status' });
  const erro = elemento('p', { role: 'alert', className: 'erro-formulario' });
  const form = elemento('form', { className: 'form-admin' }, [
    elemento('p', {}, `Substituir “${imagem.nome}”? A nova imagem aparecerá automaticamente em todos os produtos que usam esta imagem, incluindo capa, galeria e opções.`),
    elemento('p', {}, 'O nome e os vínculos serão mantidos. Os produtos já publicados serão atualizados imediatamente. JPG, PNG, WebP ou AVIF; até 8 MB.'),
    ...(imagem.usos.length ? [elemento('ul', {}, imagem.usos.map(uso => elemento('li', {}, uso)))] : []),
    origem, arquivo, areaColar, link, previa, estado,
    elemento('button', { type: 'submit', className: 'botao' }, 'Confirmar substituição'), erro,
  ]);
  const janela = dialogo('Substituir imagem', form);
  let url;
  let colada;
  let enviando = false;
  function mostrarPrevia(nova) {
    erro.textContent = '';
    if (nova?.size > 8 * 1024 * 1024) {
      erro.textContent = 'Envie uma imagem com até 8 MB.';
      return false;
    }
    if (url) URL.revokeObjectURL(url);
    url = null;
    if (nova) url = URL.createObjectURL(nova);
    previa.src = url || imagem.miniatura_url;
    return true;
  }
  function mudarOrigem() {
    const valor = form.elements.origem.value;
    arquivo.hidden = valor !== 'arquivo';
    entrada.disabled = valor !== 'arquivo';
    entrada.required = valor === 'arquivo';
    areaColar.hidden = valor !== 'colar';
    link.hidden = valor !== 'link';
    form.elements.url.disabled = valor !== 'link';
    form.elements.url.required = valor === 'link';
    previa.hidden = valor === 'link';
    estado.textContent = valor === 'link' ? 'O link será validado ao confirmar a substituição.'
      : valor === 'colar' && !colada ? 'Nenhuma imagem colada.' : 'Confira a imagem antes de confirmar.';
    mostrarPrevia(valor === 'colar' ? colada : entrada.files[0]);
  }
  origem.querySelector('select').addEventListener('change', mudarOrigem);
  entrada.addEventListener('change', () => {
    if (!mostrarPrevia(entrada.files[0])) entrada.value = '';
  });
  form.addEventListener('paste', (evento) => {
    const imagens = [...(evento.clipboardData?.items || [])]
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'));
    if (!imagens.length) return;
    evento.preventDefault();
    if (enviando) return;
    if (imagens.length !== 1) {
      erro.textContent = 'Cole apenas uma imagem para substituir.';
      return;
    }
    const nova = imagens[0].getAsFile();
    if (!nova || !mostrarPrevia(nova)) return;
    colada = nova;
    form.elements.origem.value = 'colar';
    mudarOrigem();
    estado.textContent = 'Imagem colada. Confira a prévia e confirme a substituição.';
  });
  mudarOrigem();
  janela.dialog.addEventListener('close', () => { if (url) URL.revokeObjectURL(url); }, { once: true });
  enviar(form, async () => {
    const valor = form.elements.origem.value;
    let dados;
    if (valor === 'link') {
      dados = { url: form.elements.url.value.trim(), arquivo_anterior: imagem.arquivo };
    } else {
      const nova = valor === 'colar' ? colada : entrada.files[0];
      if (!nova) throw new Error('Adicione uma imagem antes de confirmar.');
      if (nova.size > 8 * 1024 * 1024) throw new Error('Envie uma imagem com até 8 MB.');
      dados = new FormData();
      dados.set('imagem', nova, nova.name || 'imagem-colada.png');
      dados.set('arquivo_anterior', imagem.arquivo);
    }
    enviando = true;
    try {
      const atualizada = await requisitar(`/api/admin/midias/${imagem.id}/substituir`, { method: 'POST', body: dados });
      aoSubstituir(atualizada);
      janela.dialog.close();
      avisar('Imagem substituída na biblioteca e em todos os produtos vinculados.');
    } finally { enviando = false; }
  }, erro);
}
