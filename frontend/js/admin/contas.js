import { requisitar, usuarioAtual } from './api.js';
import { elemento, campo, titulo, tabela, botao, dialogo, enviar, avisar } from './interface.js';

export async function montar(container) {
  const autor = usuarioAtual();
  const contas = await requisitar('/api/acesso/contas');
  container.replaceChildren(titulo('Contas', 'Gerencie o acesso de clientes e equipe. Bloqueios encerram as sessões e preservam os dados.'));

  function confirmar(conta, acao) {
    const rotulos = { banir: 'Banir conta', suspender: 'Suspender conta', liberar: 'Remover bloqueio' };
    const explicacao = acao === 'banir' ? 'O acesso ficará bloqueado sem prazo, até um administrador remover o banimento.'
      : acao === 'suspender' ? 'O acesso será liberado após o prazo escolhido. A pessoa precisará entrar novamente.'
        : 'Remove o banimento ou a suspensão. Contas desativadas continuam sem acesso até serem reativadas.';
    const form = elemento('form', { className: 'form-admin' }, [
      elemento('p', {}, `${conta.nome} · ${conta.email}`),
      elemento('p', {}, explicacao),
    ]);
    if (acao === 'suspender') form.append(campo('Duração da suspensão', 'dias', '7', 'select', [
      { valor: 1, nome: '1 dia' }, { valor: 7, nome: '7 dias' }, { valor: 30, nome: '30 dias' },
    ]));
    form.append(elemento('button', { type: 'submit', className: 'botao' }, rotulos[acao]));
    const modal = dialogo(rotulos[acao], form);
    enviar(form, async (dados) => {
      await requisitar(`/api/acesso/contas/${conta.id}/restricao`, {
        method: 'PUT', body: { acao, ...(acao === 'suspender' ? { dias: Number(dados.get('dias')) } : {}) },
      });
      modal.dialog.close();
      avisar('Situação da conta atualizada.');
      await montar(container);
    }, modal.erro);
  }

  function promover(conta) {
    const form = elemento('form', { className: 'form-admin' }, [
      elemento('p', {}, `${conta.nome} · ID: ${conta.id}`),
      elemento('p', {}, 'A mudança encerra as sessões e mantém eventuais bloqueios existentes.'),
      campo('Novo perfil', 'perfil', 'administrador', 'select', [
        { valor: 'administrador', nome: 'Administrador' }, { valor: 'criador', nome: 'Criador' },
      ]),
      elemento('button', { type: 'submit', className: 'botao' }, 'Confirmar perfil'),
    ]);
    const modal = dialogo('Promover conta', form);
    enviar(form, async (dados) => {
      await requisitar(`/api/acesso/contas/${conta.id}/perfil`, {
        method: 'PUT', body: { perfil: dados.get('perfil') },
      });
      modal.dialog.close();
      avisar('Perfil atualizado.');
      await montar(container);
    }, modal.erro);
  }

  const pesquisa = campo('Pesquisar por ID, nome ou e-mail', 'pesquisa-conta', '', 'search');
  const resultados = elemento('div');
  function desenhar() {
    const consulta = pesquisa.querySelector('input').value.trim().toLocaleLowerCase('pt-BR');
    const filtradas = contas.filter((conta) => /^#?\d+$/.test(consulta)
      ? String(conta.id) === consulta.replace(/^#/, '')
      : `${conta.nome} ${conta.email}`.toLocaleLowerCase('pt-BR').includes(consulta));
    resultados.replaceChildren(tabela(['ID', 'Pessoa', 'E-mail', 'Perfil', 'Situação', 'Ações'], filtradas.map((conta) => {
      const protegida = conta.id === 2 || (conta.perfil === 'criador' && autor.perfil !== 'criador');
      const podeBloquear = !protegida && conta.id !== autor.id;
      const situacao = conta.situacao === 'banida' ? 'Banida' : conta.situacao === 'suspensa'
        ? `Suspensa até ${new Date(conta.suspensa_ate).toLocaleString('pt-BR')}` : conta.ativo ? 'Ativa' : 'Desativada';
      return elemento('tr', {}, [
        elemento('td', {}, conta.id),
        elemento('td', {}, conta.nome), elemento('td', {}, conta.email),
        elemento('td', {}, conta.perfil === 'criador' ? 'Criador' : conta.perfil),
        elemento('td', {}, situacao), elemento('td', {}, elemento('div', { className: 'acoes-linha' }, [
          podeBloquear && conta.situacao !== 'banida'
            && (conta.perfil !== 'administrador' || autor.perfil === 'criador')
            ? botao('Banir conta', () => confirmar(conta, 'banir')) : null,
          podeBloquear && conta.situacao === 'liberada' ? botao('Suspender', () => confirmar(conta, 'suspender')) : null,
          !protegida && conta.situacao !== 'liberada' ? botao('Remover bloqueio', () => confirmar(conta, 'liberar')) : null,
          !protegida && conta.id !== autor.id && autor.perfil === 'criador'
            ? botao('Promover conta', () => promover(conta)) : null,
          conta.id === 2 ? elemento('span', {}, 'Criador protegido') : null,
        ])),
      ]);
    })));
    if (!filtradas.length) resultados.append(elemento('p', {}, 'Nenhuma conta encontrada.'));
  }
  pesquisa.addEventListener('input', desenhar);
  container.append(pesquisa, resultados);
  desenhar();
}
