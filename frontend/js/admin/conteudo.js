import { requisitar } from './api.js';
import { elemento, campo, controlar, titulo, botao, enviar, avisar } from './interface.js';
import { selecionarMidia } from './midias.js';

export async function montar(container) {
  const secoes = await requisitar('/api/admin/conteudo');
  const form = elemento('form', { className: 'form-admin' });
  container.replaceChildren(titulo('Conteúdo da landing page', 'Edite o rascunho, confira a prévia e publique quando estiver pronto.'));
  for (const item of secoes) {
    const imagem = elemento('p', {}, item.imagem_id ? 'Imagem selecionada.' : 'Sem imagem nesta seção.');
    const bloco = elemento('fieldset', { className: 'bloco-admin' }, [
      elemento('legend', {}, item.id),
      controlar(campo('Título', '', item.titulo), (valor) => { item.titulo = valor; }),
      controlar(campo('Texto', '', item.texto, 'textarea'), (valor) => { item.texto = valor; }),
      controlar(campo('Texto do botão', '', item.chamada), (valor) => { item.chamada = valor; }),
      controlar(campo('Mostrar esta parte no site', '', item.visivel, 'checkbox'), (valor) => { item.visivel = valor; }),
      imagem,
      elemento('div', { className: 'acoes-linha' }, [
        botao('Selecionar imagem', async () => {
          const escolhida = await selecionarMidia();
          if (escolhida) { item.imagem_id = escolhida.id; imagem.textContent = escolhida.nome; }
        }),
        botao('Remover imagem da seção', () => { item.imagem_id = ''; imagem.textContent = 'Sem imagem nesta seção.'; }),
      ]),
    ]);
    for (const passo of item.passos || []) {
      bloco.append(
        controlar(campo('Título do passo', '', passo.titulo), (valor) => { passo.titulo = valor; }),
        controlar(campo('Texto do passo', '', passo.texto, 'textarea'), (valor) => { passo.texto = valor; }),
      );
    }
    form.append(bloco);
  }
  const erro = elemento('p', { role: 'alert', className: 'erro-formulario' });
  async function salvar() {
    await requisitar('/api/admin/conteudo', { method: 'PUT', body: secoes });
    avisar('Rascunho da landing page salvo.');
  }
  form.append(elemento('div', { className: 'acoes-linha' }, [
    elemento('button', { type: 'submit', className: 'botao' }, 'Salvar rascunho'),
    botao('Salvar e visualizar prévia', async () => {
      const janela = window.open('about:blank', '_blank');
      try { await salvar(); janela ? janela.location.replace('/?previa=1') : window.location.assign('/?previa=1'); }
      catch (falha) { janela?.close(); throw falha; }
    }),
    botao('Salvar e publicar', async () => {
      await salvar();
      await requisitar('/api/admin/conteudo/publicar', { method: 'POST', body: {} });
      avisar('Landing page publicada. Atualize o site para conferir.');
    }),
  ]));
  enviar(form, salvar, erro);
  container.append(erro, form);
}
