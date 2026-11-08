import { requisitar } from './api.js';
import { elemento, campo, titulo, tabela, botao, dialogo, enviar, avisar } from './interface.js';

export async function montar(container) {
  const categorias = await requisitar('/api/admin/categorias');
  container.replaceChildren(titulo('Categorias', 'Arquivar uma categoria oculta seus produtos do catálogo público, preservando os vínculos.'));
  async function editar(categoria = {}) {
    const form = elemento('form', { className: 'form-admin' }, [
      campo('Nome da categoria', 'nome', categoria.nome), campo('Nome no link da categoria (opcional)', 'slug', categoria.slug),
      campo('Mostrar esta categoria no site', 'ativa', categoria.ativa !== 0, 'checkbox'),
      elemento('button', { type: 'submit', className: 'botao' }, 'Salvar categoria'),
    ]);
    form.elements.nome.required = true;
    const modal = dialogo(categoria.id ? 'Editar categoria' : 'Nova categoria', form);
    enviar(form, async (dados) => {
      await requisitar(`/api/admin/categorias${categoria.id ? `/${categoria.id}` : ''}`, {
        method: categoria.id ? 'PUT' : 'POST',
        body: { ...Object.fromEntries(dados), posicao: categoria.posicao || 0, ativa: dados.has('ativa') },
      });
      modal.dialog.close();
      avisar('Categoria salva.');
      await montar(container);
    }, modal.erro);
  }
  container.append(botao('Nova categoria', () => editar(), 'botao'), tabela(['Nome', 'Endereço', 'Situação', 'Ações'],
    categorias.map((item) => elemento('tr', {}, [
      elemento('td', {}, item.nome), elemento('td', {}, item.slug),
      elemento('td', {}, item.ativa ? 'Ativa' : 'Arquivada'),
      elemento('td', {}, botao('Editar', () => editar(item))),
    ]))));
}
