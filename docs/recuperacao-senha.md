# Recuperação por código pelo Gmail

A tela `/paginas/recuperar-conta.html` solicita e-mail, valida um código de seis dígitos e somente então exibe nova senha e confirmação. O fluxo atende contas ativas de qualquer perfil, sem conceder novas permissões. Não é necessário que o destinatário use Gmail: a conta remetente envia pelo Gmail aos e-mails cadastrados.

## Configuração do remetente

O envio usa a API Gmail por HTTPS, com `fetch` do Node.js. Não utiliza a senha normal do Gmail nem senha de app SMTP. O Railway bloqueia SMTP nos planos Free, Trial e Hobby; a API HTTPS evita essa dependência de plano.

1. No [Google Cloud Console](https://console.cloud.google.com/), crie ou selecione um projeto e habilite a **Gmail API**.
2. Configure a tela de consentimento OAuth e crie um cliente OAuth do tipo aplicação web. Autorize somente a conta que enviará os e-mails; os clientes da gráfica não precisam autorizar o aplicativo Google.
3. Para obter a autorização inicial com o [OAuth Playground do Google](https://developers.google.com/oauthplayground/), cadastre `https://developers.google.com/oauthplayground` como URI de redirecionamento do cliente. Nas configurações do Playground, ative **Use your own OAuth credentials** e informe o ID e o segredo do seu próprio cliente.
4. Solicite apenas o escopo `https://www.googleapis.com/auth/gmail.send`. Entre na conta remetente, autorize o envio e troque o código de autorização pelos tokens. Guarde o **refresh token** nas variáveis privadas do servidor. Não envie tokens pelo chat nem os registre no código, histórico ou frontend.
5. No Railway, configure as variáveis abaixo e aplique a atualização. Localmente, use `.env`, que não entra na publicação.

| Variável | Conteúdo |
| --- | --- |
| `GMAIL_USUARIO` | Endereço da conta Google que autorizou o envio |
| `GMAIL_CLIENT_ID` | ID do cliente OAuth do projeto Google |
| `GMAIL_CLIENT_SECRET` | Segredo desse cliente OAuth |
| `GMAIL_REFRESH_TOKEN` | Refresh token da conta remetente para o escopo `gmail.send` |

O token de acesso é renovado pelo servidor a cada envio e mantido apenas durante a requisição. A aplicação pede somente permissão de envio; não solicita acesso de leitura à caixa de entrada. O remetente precisa corresponder à conta autorizada. Respeite os limites de envio da conta Google.

Em aplicativos OAuth externos no estado **Testing**, autorizações podem expirar após sete dias. Antes do uso contínuo, ajuste o estado de publicação e cumpra os requisitos de consentimento/verificação exigidos pelo Google para o seu aplicativo. Revogar o acesso ou trocar as credenciais pode exigir nova autorização.

Referências: [envio pela Gmail API](https://developers.google.com/workspace/gmail/api/guides/sending), [OAuth e acesso offline](https://developers.google.com/identity/protocols/oauth2/web-server#offline), [restrições de SMTP do Railway](https://docs.railway.com/networking/outbound-networking).

## Funcionamento e proteção

Antes de sair do login, **Esqueci minha senha** confere o e-mail informado e mostra **E-mail incorreto. Confira o endereço cadastrado.** quando não há conta ativa disponível. A conferência usa `POST /api/conta/conferir-email-recuperacao`, limitada a dez tentativas por IP a cada quinze minutos. Esse aviso torna a existência de uma conta consultável por e-mail, conforme o comportamento solicitado para a interface. Contas bloqueadas ou inativas recebem o mesmo aviso de endereço incorreto. A solicitação de envio mantém sua resposta neutra.

- `POST /api/conta/solicitar-codigo`, com `email`: retorna resposta neutra e um identificador aleatório do desafio, nunca o código. O envio só é tentado para contas ativas e não bloqueadas. Sem configuração, retorna indisponibilidade (503) para qualquer endereço.
- `POST /api/conta/validar-codigo`, com `desafio` e `codigo`: após confirmação, retorna uma autorização aleatória e temporária. Essa autorização é necessária mesmo se alguém mostrar manualmente os campos de senha no navegador.
- `POST /api/conta/redefinir-com-codigo`, com `permissao`, `senha` e `confirmacao`: redefine a senha e encerra todas as sessões, códigos e links de recuperação da conta. Não inicia sessão automaticamente.
- Prazo total de dez minutos, até cinco tentativas por código e intervalo mínimo de um minuto entre envios à mesma conta. Novo envio válido invalida o anterior. Falha do Gmail inutiliza o código, mantém o intervalo e registra somente um aviso genérico, sem segredos ou confirmação fictícia de entrega.
- Limites por IP a cada quinze minutos: cinco solicitações, vinte verificações e dez redefinições. Os contadores por IP ficam em memória; prazo, intervalo e tentativas por conta persistem em SQLite.
- Migração `011-recuperacao-codigo.sql`: tabela privada sem exposição no visualizador administrativo. O banco armazena somente resumos dos identificadores e autorizações; o resumo do código usa HMAC com o desafio aleatório não armazenado em texto. O navegador guarda o desafio e a autorização apenas em memória, sem localStorage ou URL.
- Alterar senha, perfil, situação da conta ou restrições invalida os códigos. Restaurar backups também limpa os desafios. Contas banidas, suspensas ou inativas não podem recuperar o acesso enquanto bloqueadas.
- Links anteriores via Resend e a recuperação manual da equipe continuam compatíveis. O novo fluxo da página usa Gmail e código; novas solicitações invalidam recuperações anteriores da mesma conta.

## Verificação antes de ativar

Os testes automatizados interceptam o transporte, sem enviar mensagens reais. Após configurar o Google e o Railway, é necessário solicitar um código para uma conta de teste autorizada, conferir recebimento e spam, validar o código, escolher nova senha e entrar novamente. Teste também código incorreto, expirado, repetido e encerramento das sessões anteriores. Não considerar o recebimento verificado antes desse teste real.
