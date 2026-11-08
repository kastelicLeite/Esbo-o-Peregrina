import { requisitar, usuarioAtual } from './api.js';
import { elemento, campo, titulo, tabela, botao, dialogo, enviar, avisar } from './interface.js';

export async function montar(container) {
  const criador = usuarioAtual().perfil === 'criador';
  const usuarios = await requisitar('/api/acesso/usuarios');
  container.replaceChildren(titulo('Admin', 'Contas individuais. O último administrador ativo permanece protegido.'));
  async function editar(usuario = {}) {
    const form = elemento('form', { className: 'form-admin' }, [
      campo('Nome', 'nome', usuario.nome),
      campo('Permissão de acesso', 'perfil', usuario.perfil || 'editor', 'select', [
        { valor: 'cliente', nome: 'Cliente: catálogo, carrinho e minha conta' },
        { valor: 'editor', nome: 'Editor: catálogo e conteúdo' },
        { valor: 'administrador', nome: 'Administrador: conteúdo, configurações e equipe' },
        { valor: 'criador', nome: 'Criador: acesso completo ao painel' },
      ].filter((opcao) => criador || ['cliente', 'editor', usuario.perfil].includes(opcao.valor))),
    ]);
    if (usuario.id) form.append(campo('Permitir acesso desta pessoa', 'ativo', usuario.ativo, 'checkbox'));
    else {
      form.append(campo('E-mail', 'email', '', 'email'), campo('Senha de acesso desta pessoa', 'senha', '', 'password'));
      form.elements.senha.required = true;
      form.elements.senha.minLength = 12;
      form.elements.senha.autocomplete = 'new-password';
      form.append(elemento('p', {}, 'Mínimo de 12 caracteres com letras e números. Entregue a senha diretamente ao titular.'));
    }
    form.append(elemento('button', { type: 'submit', className: 'botao' }, 'Salvar conta'));
    const modal = dialogo(usuario.id ? 'Editar conta' : 'Nova conta', form);
    enviar(form, async (dados) => {
      await requisitar(`/api/acesso/usuarios${usuario.id ? `/${usuario.id}` : ''}`, {
        method: usuario.id ? 'PUT' : 'POST', body: { ...Object.fromEntries(dados), ativo: dados.has('ativo') },
      });
      modal.dialog.close();
      avisar('Conta salva. As sessões da conta editada foram encerradas.');
      await montar(container);
    }, modal.erro);
  }
  container.append(botao('Criar conta', () => editar(), 'botao'), tabela(['ID', 'Pessoa', 'E-mail', 'Perfil', 'Situação', 'Ações'],
    usuarios.map((item) => elemento('tr', {}, [
      elemento('td', {}, item.id),
      elemento('td', {}, item.nome), elemento('td', {}, item.email),
      elemento('td', {}, item.perfil === 'criador' ? 'Criador' : item.perfil),
      elemento('td', {}, item.ativo ? 'Ativa' : 'Desativada'), elemento('td', {}, item.id === 2
        || (item.perfil === 'criador' && !criador) ? 'Conta protegida' : elemento('div', { className: 'acoes-linha' }, [
        botao('Editar', () => editar(item)),
        botao('Encerrar sessões', async () => {
          await requisitar(`/api/acesso/usuarios/${item.id}/sessoes`, { method: 'DELETE' });
          avisar('Sessões encerradas.');
        }),
        item.ativo ? botao('Gerar recuperação', async () => {
          const dados = await requisitar(`/api/acesso/usuarios/${item.id}/recuperacao`, { method: 'POST', body: {} });
          const url = new URL(`/paginas/recuperar-acesso.html?token=${dados.token}`, location.origin).href;
          const painel = elemento('div', {}, [
            elemento('p', {}, 'Link de uso único, válido por 30 minutos. Entregue diretamente ao titular; não é enviado automaticamente.'),
            campo('Link de recuperação', 'link', url),
          ]);
          painel.querySelector('input').readOnly = true;
          dialogo(`Recuperar acesso de ${item.nome}`, painel);
        }) : null,
      ])),
    ]))));
}
