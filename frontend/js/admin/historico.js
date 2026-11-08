import { requisitar, exportarCatalogo } from './api.js';
import { elemento, titulo, tabela, botao, formatarData } from './interface.js';
import { montarBackups } from './backups.js';

export async function montar(container) {
  const registros = await requisitar('/api/admin/historico');
  container.replaceChildren(titulo('Histórico e manutenção', 'Alterações reais, sem senhas ou tokens no histórico.'));
  container.append(elemento('div', { className: 'bloco-admin' }, [
    elemento('h2', {}, 'Exportação do catálogo'),
    botao('Exportar catálogo em JSON', exportarCatalogo),
  ]));
  await montarBackups(container);
  container.append(tabela(['Quando', 'Pessoa', 'Ação', 'Registro'], registros.map((item) => elemento('tr', {}, [
    elemento('td', {}, formatarData(item.criado_em)), elemento('td', {}, item.autor), elemento('td', {}, item.acao),
    elemento('td', {}, `${item.entidade} #${item.registro}`),
  ]))));
}
