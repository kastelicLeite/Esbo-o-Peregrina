import { requisitar, usuarioAtual } from './api.js';
import { elemento, campo, botao, enviar, avisar, formatarData } from './interface.js';

export async function montarBackups(container) {
  const bloco = elemento('section', { className: 'bloco-admin' }, [elemento('h2', {}, 'Backups')]);
  container.append(bloco);
  if (usuarioAtual()?.perfil !== 'criador') {
    bloco.append(elemento('p', {}, 'Backups completos são gerenciados pelos Criadores, pois incluem contas e credenciais privadas.'));
    return;
  }
  async function carregar() {
    const { configuracao, copias, externo } = await requisitar('/api/admin/backups');
    bloco.replaceChildren(elemento('h2', {}, 'Backups'),
      elemento('p', {}, 'Banco, contas, imagens e configuração de recuperação. Os pacotes contêm dados privados; guarde uma cópia fora deste computador.'));
    bloco.append(elemento('h3', {}, 'Cópia externa'), elemento('p', {}, externo.mensagem));
    if (externo.configurado) bloco.append(botao('Enviar cópias externas pendentes', async () => {
      const resultado = await requisitar('/api/admin/backups/externos', { method: 'POST', body: {} });
      avisar(resultado.ocupado ? 'Já existe um envio em andamento.' : resultado.falha
        ? 'O envio externo falhou. A cópia local foi preservada.' : `${resultado.enviados} cópias externas enviadas e conferidas.`, Boolean(resultado.falha));
      await carregar();
    }));
    bloco.append(botao('Atualizar estado dos backups', carregar));
    const estado = elemento('p', { role: 'status' }, configuracao.erro || (configuracao.ultimo
      ? `Último backup automático: ${formatarData(configuracao.ultimo)}.` : 'O primeiro backup automático será criado com o servidor em funcionamento.'));
    const config = elemento('form', { className: 'form-admin' }, [
      campo('Backup automático', 'ativo', configuracao.ativo ? 'sim' : 'nao', 'select', [
        { valor: 'sim', nome: 'Ativado' }, { valor: 'nao', nome: 'Pausado' },
      ]),
      campo('Frequência', 'intervalo', String(configuracao.intervalo), 'select', [
        { valor: '6', nome: 'A cada 6 horas' }, { valor: '12', nome: 'A cada 12 horas' }, { valor: '24', nome: 'Diariamente' },
      ]),
      campo('Quantas cópias automáticas manter?', 'manter', configuracao.manter, 'number', [],
        'De 1 a 30. Cópias manuais e cópias anteriores à restauração são preservadas.'),
      elemento('button', { type: 'submit', className: 'botao-secundario' }, 'Salvar agendamento'),
    ]);
    config.elements.manter.min = '1';
    config.elements.manter.max = '30';
    config.elements.manter.required = true;
    const erro = elemento('p', { role: 'alert', className: 'erro-formulario' });
    enviar(config, async dados => {
      await requisitar('/api/admin/backups/configuracao', { method: 'PUT', body: {
        ativo: dados.get('ativo') === 'sim', intervalo: Number(dados.get('intervalo')), manter: Number(dados.get('manter')),
      } });
      avisar('Agendamento de backup salvo.');
      await carregar();
    }, erro);
    bloco.append(estado, elemento('p', {}, 'O agendamento funciona enquanto o servidor estiver ligado. Ao reiniciar, uma cópia vencida é criada automaticamente.'),
      config, erro, botao('Criar backup agora', async () => {
        await requisitar('/api/admin/backups', { method: 'POST', body: {} });
        avisar('Backup criado e verificado. Você já pode baixá-lo.');
        await carregar();
      }, 'botao'));
    const lista = elemento('div', { className: 'lista-backups' });
    if (!copias.length) lista.append(elemento('p', {}, 'Nenhum backup criado por este sistema ainda.'));
    for (const copia of copias) {
      lista.append(elemento('article', { className: 'copia-backup' }, [
        elemento('h3', {}, `${copia.automatico ? 'Automático' : 'Manual'} · ${formatarData(copia.criado_em)}`),
        elemento('p', {}, `${copia.totais.produtos} produtos · ${copia.totais.usuarios} contas · ${copia.totais.midias} imagens · ${(copia.bytes / 1048576).toFixed(1)} MB`),
        elemento('p', {}, copia.externo.status === 'enviado' ? `Cópia externa enviada e conferida em ${formatarData(copia.externo.em)}.`
          : copia.externo.status === 'falha' ? 'Envio externo com falha; cópia local preservada.'
            : externo.configurado ? 'Cópia externa aguardando envio.' : 'Cópia externa ainda não enviada.'),
        elemento('div', { className: 'acoes-backup' }, [
          botao('Verificar integridade', async () => {
            const resultado = await requisitar(`/api/admin/backups/${copia.id}/verificar`, { method: 'POST', body: {} });
            avisar(resultado.mensagem);
          }),
          elemento('a', { className: 'botao-secundario', href: `/api/admin/backups/${copia.id}/baixar`, download: '' }, 'Baixar backup'),
        ]),
      ]));
    }
    bloco.append(lista, elemento('details', { className: 'instrucoes-backup' }, [elemento('summary', {}, 'Como restaurar um backup'),
      elemento('p', {}, 'Encerre o servidor. Na pasta do projeto, execute o comando abaixo apontando para o pacote baixado. A restauração confere a integridade e guarda uma cópia do estado atual antes de substituir os dados.'),
      elemento('pre', {}, 'npm run restaurar -- "CAMINHO_DO_BACKUP.tar.gz" --confirmar'),
      elemento('p', {}, 'Para restaurar também as credenciais de recuperação, acrescente --restaurar-ambiente. Depois, inicie o site e entre novamente. As sessões anteriores serão encerradas.'),
      elemento('p', {}, 'Uma cópia externa termina em .tar.gz.enc. Primeiro use a chave guardada fora do servidor para descriptografá-la em um arquivo novo. Depois restaure o pacote normalmente.'),
      elemento('pre', {}, 'npm run descriptografar-backup -- "COPIA.tar.gz.enc" "SAIDA.tar.gz"'),
    ]));
  }
  await carregar();
}
