import { requisitar } from './api.js';
import { elemento, campo, titulo, botao, enviar, avisar } from './interface.js';
import { selecionarMidia } from './midias.js';

const grupos = [
  ['Contatos confirmados', [
    ['whatsapp', 'WhatsApp com país e DDD (somente números)'], ['telefone', 'Telefone que aparece no site'],
    ['email', 'E-mail comercial (recebe mensagens do site)'], ['endereco', 'Endereço'], ['horarios', 'Horários'],
    ['instagram', 'Link completo do Instagram (https://...)'], ['facebook', 'Link completo do Facebook (https://...)'],
  ]],
  ['Mensagens de orçamento', [
    ['mensagem', 'Mensagem enviada pelo botão do WhatsApp'], ['mensagem_produto', 'Mensagem de orçamento do produto ({produto} será substituído pelo nome)'],
  ]],
  ['Buscadores e compartilhamento', [
    ['titulo', 'Título da página'], ['descricao', 'Resumo do site para o Google'],
    ['compartilhamento', 'Título ao compartilhar o link do site'],
  ]],
  ['Privacidade', [
    ['privacidade', 'Texto de privacidade'], ['contato_privacidade', 'Contato para assuntos de dados pessoais'],
  ]],
];

export async function montar(container) {
  const dados = await requisitar('/api/admin/configuracoes');
  container.replaceChildren(titulo('Contatos e configurações', 'Use somente informações confirmadas. Campos vazios não aparecem no site.'));
  const form = elemento('form', { className: 'form-admin' });
  for (const [nome, campos] of grupos) {
    form.append(elemento('fieldset', { className: 'bloco-admin' }, [
      elemento('legend', {}, nome),
      ...campos.map(([chave, rotulo]) => campo(rotulo, chave, dados[chave],
        ['mensagem', 'mensagem_produto', 'privacidade', 'descricao'].includes(chave) ? 'textarea' : 'text')),
    ]));
  }
  for (const [chave, rotulo] of [['favicon', 'Ícone da aba do navegador'], ['imagem_compartilhamento', 'Imagem ao compartilhar o link do site']]) {
    const estado = elemento('p', {}, dados[chave] ? 'Imagem da biblioteca selecionada.' : 'Nenhuma imagem selecionada.');
    form.append(elemento('fieldset', { className: 'bloco-admin' }, [
      elemento('legend', {}, rotulo), estado,
      botao('Selecionar na biblioteca', async () => {
        const imagem = await selecionarMidia();
        if (imagem) { dados[chave] = imagem.id; estado.textContent = imagem.nome; }
      }),
      botao('Remover seleção', () => { dados[chave] = ''; estado.textContent = 'Nenhuma imagem selecionada.'; }),
    ]));
  }
  const erro = elemento('p', { role: 'alert', className: 'erro-formulario' });
  form.append(elemento('button', { type: 'submit', className: 'botao' }, 'Salvar configurações'));
  enviar(form, async (campos) => {
    await requisitar('/api/admin/configuracoes', { method: 'PUT', body: { ...dados, ...Object.fromEntries(campos) } });
    avisar('Configurações atualizadas.');
  }, erro);
  container.append(erro, form);
}
