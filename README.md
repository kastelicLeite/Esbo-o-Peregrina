# Gráfica Peregrina

Site público com catálogo e painel administrativo integrado a SQLite. O projeto permanece local, sem novo deploy ou alteração de domínio, DNS e hospedagem.

## Iniciar

Para hospedagem definitiva, consulte [armazenamento persistente e monitoramento](docs/hospedagem.md) e [backup externo criptografado](docs/backup.md#backup-externo). O projeto inclui `compose.yaml` com volume persistente e a rota `/saude`. Backup externo e alertas de monitoramento precisam de configuração; nenhum serviço externo é ativado por padrão.

Requer Node.js 24 e npm.

1. Execute `npm ci` para instalar as dependências versionadas.
2. Opcionalmente copie `.env.example` para `.env` e ajuste porta e pasta de dados. Não coloque esse arquivo no Git.
3. Execute `npm run criar-admin` e informe nome, e-mail e uma senha individual com pelo menos 12 caracteres, incluindo letras e números. A senha não é exibida no terminal. Não existe conta ou senha padrão; a antiga senha compartilhada deixou de funcionar.
4. Dê dois cliques em `iniciar-site.cmd`, ou execute `npm run preview`. O iniciador escolhe uma porta livre, escuta apenas no computador local e abre o navegador.
5. Também é possível executar `npm start` e abrir `http://localhost:3000`, salvo outra configuração de `PORT`.
6. Entre pelo botão Entrar no header ou por `/paginas/entrar-conta.html`. Informe o e-mail e a senha da sua conta. A entrada provisória apenas por senha foi removida.

Encerre os servidores antigos antes de abrir esta versão. O novo servidor impede duas instâncias usando o mesmo banco. A primeira conta só pode ser criada pelo comando local; as demais são criadas na área Equipe por um administrador.

## Manual da equipe

O atalho **Tabelas do banco** exige nova confirmação da senha compartilhada. A consulta tem liberação própria de 15 minutos, com verificação também nas APIs e nos arquivos do visualizador. A migração `014-acesso-tabelas.sql` mantém essa autorização vinculada à sessão, sem guardar a senha no navegador. Trocar a senha compartilhada ou encerrar a sessão revoga a liberação.

O painel exige uma segunda senha, compartilhada pela equipe, além do login individual. A primeira configuração é feita em `/paginas/acesso-painel.html` exclusivamente pelo Criador. O Criador altera a senha em **Senha do painel**, informando a atual. Ela fica protegida com bcrypt na tabela privada `senha_painel`; não existe senha padrão. A liberação vale por duas horas, é vinculada à sessão individual e termina com logout, revogação da sessão ou troca da senha compartilhada. As permissões individuais continuam obrigatórias. A migração `013-acesso-painel.sql` cria as tabelas sem alterar contas existentes. Backups não preservam liberações de sessão.

No painel, o atalho **Manual** abre `/paginas/painel-admin.html#manual`. O conteúdo cobre cadastro, prévia, publicação, estoque, biblioteca, orçamento e permissões, com um exemplo fictício que não cria produtos. Está disponível para Editor, Administrador e Criador; clientes e visitantes não podem consultar a API `/api/admin/manual`.

O texto fica em `backend/manual/conteudo.html`, servido pela rota protegida `backend/manual/rotas.cjs`. A navegação interna está em `frontend/js/admin/manual.js` e os estilos exclusivos em `frontend/css/paginas/manual-painel.css`. Ao mudar botões ou fluxos do painel, revise também o manual. A navegação por seção usa `#manual?secao=produtos`, por exemplo.

## Banco e migrações

O banco é criado automaticamente em `dados/peregrina.sqlite`, ou em `PASTA_DADOS`. A pasta também contém as imagens otimizadas. Ela deve ficar fora de `frontend/` e não é enviada ao Git.

O SQL visível e versionado está em `banco-de-dados/migracoes/`. Cada migração é aplicada uma única vez, em transação. A tabela `migracoes` registra a versão. As seis categorias confirmadas são criadas somente na inicialização do catálogo.

Os produtos do cadastro anterior são preservados, inclusive nome, descrição, identificador e preço antigo. Eles entram como rascunhos para revisão, pois o cadastro anterior não tinha imagens, categorias ou tiragens suficientes para publicar o novo modelo. Não há produtos, clientes ou preços fictícios no banco real. O arquivo PostgreSQL anterior `banco-de-dados/produtos.sql` é somente uma referência histórica, não a estrutura executada pelo aplicativo.

Valores comerciais são armazenados como centavos inteiros. O preço é o total da combinação e tiragem; o sistema calcula o menor total válido e a quantidade correspondente. O valor unitário é calculado a partir desses inteiros e, quando necessário, identificado como aproximado. Não há preço zero como substituto de orçamento.

## Áreas do painel

- **Visão geral:** contagens reais, pendências de publicação e alterações recentes.
- **Produtos e catálogo:** criar, editar, duplicar, prévia, publicação, rascunho, arquivamento, restauração, busca, filtros, ordenação e ações em lote. Arquivar não apaga dados relacionados. Endereços amigáveis são únicos, inclusive os ainda presentes em versões publicadas.
- **Características e combinações:** informações fixas e selecionáveis, valores ordenáveis e desativáveis, tiragens, código interno, disponibilidade e preço total. As combinações são cadastradas manualmente, sem explosão automática de possibilidades. Valores vinculados são desativados, não apagados.
- **Categorias:** criação, edição, ordenação e arquivamento. Categorias arquivadas ocultam seus produtos da consulta pública sem excluir os vínculos.
- **Biblioteca:** upload com validação real de imagem, limite de 8 MB e 32 milhões de pixels, otimização para WebP, miniaturas, pastas/grupos, texto alternativo e reutilização. A biblioteca informa os vínculos e bloqueia a exclusão de arquivos em uso, inclusive em versões publicadas ou rascunhos. Em **Substituir imagem**, escolha um arquivo, cole uma imagem copiada ou informe um link público HTTPS direto. Arquivos e imagens coladas mostram prévia; links são baixados e validados ao confirmar, com as mesmas proteções da importação. O nome e o ID são preservados, atualizando automaticamente capas, galerias e opções de todos os produtos vinculados, inclusive publicados, sem publicar outras alterações pendentes. Novos endereços evitam cache da imagem anterior; substituições concorrentes exigem atualizar a biblioteca.
- **Landing page:** títulos, textos, imagens, chamadas, passos do orçamento, visibilidade e ordem das seções existentes. Há rascunho, prévia autenticada e publicação; não é um construtor de páginas.
- **Configurações:** WhatsApp, mensagens, telefone, e-mail, endereço, horários, redes sociais, SEO, compartilhamento, favicon e privacidade. Campos vazios não geram informações inventadas. Esta área não exibe credenciais.
- **Equipe:** administradores e editores, desativação, revogação de sessões e links de recuperação. O último administrador ativo é protegido.
- **Histórico e manutenção:** auditoria, exportação do catálogo e backups completos para Criadores, com criação pelo painel, verificação e download. Backup automático diário, retenção padrão de sete cópias automáticas e agendamento configurável.

Publicar um produto exige categoria ativa, descrição, imagem principal com texto alternativo e ao menos uma combinação disponível com opções e tiragem válidas. No modo com preços, todas as combinações disponíveis precisam de um total positivo.

## Site público

Cards mostram imagem, resumo, menor preço com a quantidade correspondente ou sob orçamento. A janela de detalhes inclui galeria, características, seleção de opções e tiragem e prepara a mensagem de WhatsApp com as escolhas. O carrinho de orçamento e o contato pelo WhatsApp continuam públicos e não exigem login. Há cadastro opcional de clientes. Não há checkout, pagamento ou histórico de pedidos: abrir o WhatsApp não confirma o envio de uma solicitação.

A consulta pública utiliza somente versões publicadas e categorias ativas. Salvar a edição de um produto já publicado não altera o site até a nova publicação. As prévias exigem autenticação. As APIs e páginas dinâmicas usam `Cache-Control: no-store`; atualizar ou consultar novamente o catálogo recebe o estado publicado sem novo deploy. As imagens usam nomes únicos e cache de uma hora.

A identidade, logo, cores e botão flutuante de WhatsApp foram preservados. As referências visuais de cards e janela de opções foram implementadas sobre a estética do projeto. Não foram fornecidas novas fotografias da empresa; a biblioteca real permanece sem imagens fictícias.

## Autenticação e segurança

As senhas usam bcrypt com salt aleatório e custo 12. Sessões persistidas guardam somente o hash de um token aleatório, expiram em oito horas e são enviadas por cookie HttpOnly e SameSite=Strict. Em HTTPS ou com NODE_ENV=production, o cookie recebe Secure. Em produção, use HTTPS. Atrás de um único proxy confiável, configure `CONFIAR_PROXY=1`; não habilite essa opção sem conhecer a infraestrutura.

As escritas de áreas autenticadas exigem perfil autorizado e token CSRF da sessão. Cadastro, login e solicitação de recuperação são públicos, limitados por IP e protegidos pela validação de origem; não exigem uma sessão anterior. Há limitação de tentativas de login e recuperação, validação no servidor, consultas parametrizadas, cabeçalhos de segurança e apresentação de conteúdo como texto. Administradores gerenciam equipe e configurações; editores gerenciam catálogo, imagens e conteúdo. Desativar uma conta encerra seus acessos. Senhas e tokens não são registrados na auditoria.

A senha compartilhada anterior não é usada nem migrada para uma conta. As variáveis privadas continuam em `.env` ou no ambiente do servidor. O projeto não contém uma senha inicial conhecida.

## Recuperação de acesso

Um administrador pode gerar um link de uso único e validade de 30 minutos para uma conta ativa na área Equipe. O link deve ser entregue diretamente ao titular por um canal adequado. Esse mecanismo manual é exclusivo da equipe e foi preservado; não gera links de clientes nem envia e-mail ou SMS.

Se nenhum administrador conseguir entrar, quem tem acesso autorizado ao servidor pode executar `npm run recuperar-acesso`, informar o e-mail da conta e entregar o link temporário. O comando não define uma senha padrão e não exige expor tokens no histórico de auditoria. Ao usar o link, todas as sessões anteriores da conta são encerradas. Em ambiente com porta aleatória, abra o caminho de recuperação na origem em que o site está rodando ou defina `URL_PUBLICA` antes de gerar o link.

## Backup e hospedagem

O backup **automático diário** funciona enquanto o servidor está ligado e mantém sete cópias automáticas por padrão. Criadores podem criar, conferir e baixar pacotes em **Histórico e manutenção → Backups** e alterar frequência/retenção. Os pacotes incluem banco, contas com senhas protegidas, imagens, configurações e credenciais de recuperação; guarde-os em local privado e mantenha uma cópia fora do computador. Sessões e recuperações temporárias não são reaproveitadas. O padrão é `dados/backups/`; `PASTA_BACKUPS` permite outro diretório privado persistente. Cópias manuais não entram na retenção. No terminal, use `npm run backup` com o servidor parado. Para restaurar uma pasta ou pacote: `npm run restaurar -- "CAMINHO_DO_BACKUP.tar.gz" --confirmar`. A restauração valida SHA-256, integridade e vínculos do banco e preserva o estado anterior. Acrescente `--restaurar-ambiente` somente se desejar restaurar também as credenciais `.env`. Consulte [docs/backup.md](docs/backup.md).

Para uma futura publicação no Railway, banco e imagens precisam de um volume persistente apontado por `PASTA_DADOS`, uma única instância e uma estratégia real de cópia fora do volume. Não há alteração de serviço ou deploy nesta tarefa. Não envie ao GitHub enquanto o deploy automático conectado puder reativar o site sem autorização.

## Organização

- `backend/dados/`: abertura do SQLite, migrações e valores iniciais confirmados.
- `backend/autenticacao/`: contas, sessões, permissões e recuperação.
- `backend/produtos/`: validação, regras comerciais e administração.
- `backend/midias/`: upload e gerenciamento de imagens.
- `backend/conteudo/`: landing page e configurações.
- `backend/manutencao/`: backup e restauração.
- `backend/aplicacao.cjs`: rotas HTTP, arquivos públicos e tratamento de erros.
- `frontend/js/admin/`: módulos de cada área do painel.
- `frontend/paginas/`: páginas públicas, login, recuperação e painel.
- `frontend/css/`: base, componentes, layout e páginas.
- `scripts/`: inicialização e comandos locais de manutenção.
- `tests/`: testes com bancos e imagens temporários, separados dos dados reais.

## Estoque no painel

O estoque é um controle interno por produto, em unidades. Informe a quantidade no cadastro ou diretamente no card de Produtos e catálogo e use “Salvar estoque” (ou Enter). Zero indica “Sem estoque”; vazio indica “Sem controle”. Produtos anteriores começam sem controle, sem alteração da disponibilidade pública.

A edição rápida salva o valor e registra a alteração no histórico, sem publicar rascunhos. Valores negativos, fracionados ou acima de 10.000.000 são rejeitados. Alterações simultâneas são detectadas para evitar sobrescrita. O carrinho de orçamento não faz baixa automática de estoque, pois não confirma pedidos. Cópias de produtos começam sem estoque controlado.

## Landing page institucional

A página inicial reúne apresentação, cartões de materiais, quatro etapas do pedido, diferenciais, formulário de orçamento e perguntas frequentes. Os cartões preenchem o material no formulário. A mensagem usa o WhatsApp centralizado nas configurações, mostra um resumo para revisão e não envia nem registra um pedido automaticamente. Se o endereço ficar longo, o visitante pode copiar o resumo completo e abrir a conversa.

Os títulos, textos, chamadas e etapas existentes continuam ligados ao editor de conteúdo do painel; o quarto passo é disponibilizado também para cadastros anteriores. Os materiais ficam em `frontend/js/inicio/materiais.js`, o formulário em `frontend/js/inicio/formulario.js` e os estilos adicionais em `frontend/css/paginas/landing.css`.

## Prévia editável do produto

O botão “Prévia editável” abre a apresentação pública do produto ao lado de um painel de configurações. No modo Editar cadastro, clicar no nome, descrição, imagens, características, tiragens ou preço abre a seção correspondente. O modo Simular cliente libera os seletores sem alterar o cadastro. Os dois modos reutilizam o componente público de detalhes.

O painel permite ordenar imagens, características, opções e tiragens; editar textos e preços; e habilitar combinações compatíveis. Alterações atualizam a prévia e o rascunho local imediatamente. Descartar restaura o preenchimento que existia ao abrir a prévia, mediante confirmação. Salvar rascunho e Publicar reutilizam o fluxo do cadastro, sem publicação automática. A ordem das tiragens é preservada no catálogo público.

O controle da janela, a adaptação do rascunho para a apresentação pública e o painel ficam separados em `frontend/js/admin/previa-produto.js`, `previa-dados.js` e `previa-painel.js`.

## Carrinho de orçamento do visitante

O acesso “Meu orçamento” no cabeçalho reúne até 50 configurações, com um lote por item e as tiragens cadastradas no catálogo. O visitante pode editar as opções, remover itens ou limpar o orçamento com confirmação. Configurações iguais não são duplicadas. Os itens ficam no armazenamento local do navegador, sem exigir conta.

`POST /api/orcamento/validar` confere o catálogo publicado ao restaurar os itens e antes de preparar a mensagem. Os preços do navegador não são considerados definitivos. Produtos arquivados ou opções indisponíveis impedem o envio até a correção; tiragens cadastradas sem preço válido aparecem como “Sob orçamento”. Carrinhos mistos mostram apenas o subtotal dos itens com preço.

A revisão prepara uma mensagem completa para o WhatsApp configurado no painel. O cliente abre a conversa e envia manualmente; isso não confirma um pedido nem limpa o carrinho. Links com mais de 7.000 caracteres oferecem cópia do resumo completo e abertura da conversa sem o texto no endereço.

O estado, a interface, a validação e a mensagem ficam separados em `frontend/js/orcamento/` e `backend/produtos/orcamento.cjs`. Os testes usam dados temporários e não alteram o catálogo real.

## Dependências utilizadas

Express organiza as rotas; bcryptjs calcula e valida hashes de senha; sharp valida e otimiza imagens; multer recebe uploads limitados; Helmet aplica cabeçalhos de segurança; express-rate-limit limita tentativas. O SQLite é o módulo nativo do Node.js. `package-lock.json` registra as versões. Não há serviço externo obrigatório para executar localmente.

## Verificações

`npm test` verifica migração dos dados anteriores, autenticação, autorização, CSRF, proteção do último administrador, upload inválido e válido, opções, tiragens, preços, duplicação, prévia, publicação, edição, lote atômico, arquivamento, categorias, conteúdo, contatos, exportação, recuperação, persistência e restauração. Também verifica sintaxe, importações e referências do frontend.

A revisão no navegador usa uma base temporária: cadastro pelo painel, janela de opções, seleção de tiragens, cálculo do total e unitário, mensagem de WhatsApp, fechamento por teclado e apresentação em tela estreita. Não há dados de teste no banco real.

## Contas de clientes

Os nomes de conta são únicos entre clientes e equipe. Cadastro e alteração de nome rejeitam nomes já utilizados, desconsiderando maiúsculas, minúsculas e espaços extras. A migração `007-nomes-unicos.sql` acrescenta um índice de unicidade; a validação compartilhada também normaliza Unicode e verifica conflitos dentro da transação. O titular pode manter seu próprio nome. Contas existentes não são renomeadas automaticamente.

Sem uma sessão ativa, o header mostra os botões **Entrar** e **Cadastrar**. Após o login, eles dão lugar a **Minha conta**, que pode ser usada por clientes e equipe para editar seus próprios dados e sair. Essas ações não alteram o perfil nem permitem editar outras contas. As páginas são:

- `/paginas/cadastro.html`: nome, e-mail, senha e confirmação, sem autorização automática de publicidade.
- `/paginas/entrar-conta.html`: login único para todas as contas cadastradas.
- `/paginas/recuperar-conta.html`: solicitação de recuperação e definição da nova senha pelo link recebido.
- `/paginas/minha-conta.html`: consulta do e-mail, alteração do nome, alteração de senha com confirmação da senha atual e saída.

O botão **Modo escuro** em Minha conta altera o tema de todas as páginas do site. A preferência fica salva no navegador, é aplicada antes de exibir a página e não depende de uma sessão ativa. O armazenamento dessa preferência não contém dados da conta.

Administradores gerenciam clientes e equipe em **Painel → Contas**, com pesquisa por nome ou e-mail. **Banir conta** bloqueia o acesso sem prazo até a remoção manual; **Suspender** bloqueia por 1, 7 ou 30 dias e libera automaticamente novos logins após o vencimento. As ações pedem confirmação, encerram sessões, invalidam links de recuperação e registram autoria no histórico, sem excluir dados. Remover o bloqueio não reativa contas desativadas nem restaura sessões antigas. Não é possível bloquear a própria conta ou o último administrador com acesso. A migração **008-restricoes-contas.sql** cria a tabela de restrições sem alterar migrações anteriores.

O perfil **Criador** tem acesso completo e pode banir administradores e outros Criadores, suspender contas e usar **Contas → Promover conta** para atribuir Administrador ou Criador. Administradores não podem banir administradores, atribuir Criador ou gerenciar contas Criador. A conta **ID 2** recebe o perfil Criador pela migração **010-criador-protegido.sql**, mantendo nome, e-mail e senha; na interface seu nome de perfil é apenas Criador. Essa conta não pode ser bloqueada, rebaixada, desativada ou ter recuperação manual gerada por outras contas. Seus acessos anteriores são encerrados para exigir novo login. Se não houver conta ID 2, a migração não cria uma conta fictícia. Alterar o perfil não remove bloqueios anteriores. O ID da conta aparece no topo do painel, nas tabelas de contas e equipe e em Minha conta. A migração **009-perfil-criador.sql** amplia os perfis preservando usuários, índices, sessões, recuperação, histórico e restrições. O cadastro público continua criando exclusivamente clientes.

A migração **006-clientes.sql** amplia o CHECK de perfil e preserva IDs, hashes, sessões, links administrativos existentes e histórico. Não há tabela paralela de contas. Todas as contas entram pela mesma tela com e-mail e senha. O endereço antigo `/paginas/entrar.html` redireciona para essa tela. Após entrar, todas as contas seguem para a página de produtos. O painel tem atalhos no header e no rodapé, exibidos apenas para administradores; não há redirecionamento automático ao painel. As permissões de cada perfil continuam validadas no servidor. Cadastro público ignora campos como perfil, id, ativo e permissões e cria exclusivamente clientes. A área Equipe lista e modifica somente administradores e editores. Clientes não podem acessar APIs, HTML ou visualizador do painel. O comando de criação do primeiro administrador funciona mesmo se já houver cadastros de clientes.

As rotas de clientes ficam em `/api/conta`: POST `/cadastro`, `/entrar`, `/solicitar-recuperacao`, `/redefinir-senha`, `/sair`; GET `/sessao`; PATCH `/nome`; PUT `/senha`. Os campos de senha são `senha` e `confirmacao`; alteração autenticada também exige `senha_atual`. Nome e senha sempre se referem ao titular da sessão, nunca a um ID enviado pelo navegador. Escritas autenticadas exigem `X-CSRF-Token`, obtido na consulta da sessão.

O cookie HttpOnly existente, chamado `peregrina_admin` por compatibilidade, é compartilhado: entrar em outra conta substitui o acesso daquele navegador e revoga sua sessão anterior. As APIs verificam também o perfil. Nenhuma senha ou token de sessão é guardado no armazenamento local. O carrinho anônimo permanece separado e não é apagado ao entrar ou sair. As senhas exigem pelo menos 12 caracteres, letras e números e no máximo 72 bytes UTF-8; bytes excedentes são rejeitados, sem truncamento pelo bcrypt.

Cadastro usa resposta neutra também para e-mails já cadastrados, sem sobrescrever contas existentes nem iniciar sessão automaticamente. Login aceita qualquer perfil ativo e não distingue conta inexistente, inativa ou senha incorreta nas mensagens de erro. Limites por IP a cada 15 minutos: 5 cadastros, 10 logins pela entrada unificada, 5 solicitações de recuperação, 10 tentativas de redefinição e 10 alterações de senha autenticadas. Os limites administrativos existentes continuam ativos. Contadores ficam em memória e são reiniciados com o processo; múltiplas instâncias exigiriam armazenamento compartilhado desses contadores.

### Recuperação atual por código Gmail

A página de recuperação agora envia um código de seis dígitos pelo Gmail e só libera os campos de nova senha e confirmação após validá-lo no servidor. O código dura dez minutos e permite até cinco tentativas; novo envio respeita um intervalo de um minuto. A redefinição exige uma autorização temporária, invalida códigos e links e encerra sessões anteriores. Funciona para todos os perfis ativos e não bloqueados, preservando suas permissões.

O envio usa a **API Gmail por HTTPS**, compatível com a restrição de SMTP dos planos menores do Railway. Configure `GMAIL_USUARIO`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` e `GMAIL_REFRESH_TOKEN` nas variáveis privadas do servidor. Não utilize a senha normal do e-mail. Veja o procedimento de autorização Google, os limites e a verificação real de entrega em [docs/recuperacao-senha.md](docs/recuperacao-senha.md). Sem credenciais, o envio permanece indisponível; não há simulação de entrega. A migração `011-recuperacao-codigo.sql` preserva os dados existentes e adiciona os desafios privados.

### Compatibilidade com links anteriores de recuperação

A integração usa a [API oficial do Resend](https://resend.com/docs/api-reference/emails/send-email), pelo fetch nativo do Node.js, sem nova dependência npm. Configure no servidor, sem expor no frontend:

- `RESEND_API_KEY`: chave autorizada a enviar e-mails no Resend.
- `EMAIL_REMETENTE`: remetente permitido pelo provedor, por exemplo `Gráfica Peregrina <contas@seu-dominio>`.
- `URL_PUBLICA`: origem real do site, usada no link; HTTPS obrigatório com `NODE_ENV=production`.

É necessário ter o remetente/domínio autorizado no provedor e acesso de saída HTTPS a `api.resend.com`. Esta implementação não altera DNS, domínio ou hospedagem e não configura nem contrata o provedor automaticamente. Sem essas variáveis válidas, a solicitação retorna 503 com aviso de indisponibilidade para qualquer e-mail. Cadastro e login continuam disponíveis.

Links de clientes duram 30 minutos, são de uso único e usam token aleatório com somente seu SHA-256 no banco. O token é enviado exclusivamente no corpo do e-mail e no fragmento do link, removido da barra de endereço ao abrir a página; não é devolvido pela API pública nem pelos links manuais da equipe. Novo link invalida o anterior. Redefinir a senha encerra todas as sessões e remove os links pendentes. Alterar a senha na conta também encerra todas as sessões e pede novo login.

A resposta da solicitação é deliberadamente neutra e diz que o envio será tentado: não confirma existência de conta, entrega ou leitura do e-mail. Falhas do provedor não devolvem detalhes ou tokens e invalidam o link que não pôde ser enviado; o servidor registra somente um aviso genérico para diagnóstico. Não há simulação de envio nem fila de reenvio automático. Se o link não chegar, a tela orienta tentar mais tarde ou falar com a equipe. A recuperação manual da equipe permanece independente.

### Recomendados e histórico pessoal

As páginas `/paginas/recomendados.html` e `/paginas/historico.html` usam os cartões do catálogo e respeitam o tema do site. O algoritmo combina pesquisas, produtos vistos, categorias e orçamentos preparados, com redução de peso ao longo de 21 dias, descarte de sinais com mais de 90 dias e penalidade por repetição de categoria na seleção. Sem sinais pessoais, usa destaques e ordem do catálogo; não inventa compras ou popularidade. Apenas produtos públicos com combinações disponíveis entram nas sugestões, e cada cartão informa o motivo.

Com login, a migração `012-historico-clientes.sql` guarda eventos e preferência na conta, disponíveis em outros dispositivos. As rotas GET/POST/DELETE `/api/conta/historico` e PUT `/api/conta/historico/preferencia` usam exclusivamente o titular da sessão, com CSRF nas escritas. Nenhum ID de usuário enviado pelo navegador muda o titular. O visualizador administrativo não expõe essas tabelas; backups completos de Criadores incluem esses dados privados.

Visitantes usam o armazenamento deste navegador, sem vincular nem transferir automaticamente os registros ao entrar em uma conta. Falha de rede na identificação da sessão não cai silenciosamente no histórico de visitante. Histórico e preferência podem ser pausados, retomados e limpos. Limites: 50 pesquisas, 100 produtos vistos e 30 orçamentos preparados; pesquisas e visualizações repetidas atualizam o registro recente. Consultas exibem os últimos 90 dias, e o servidor elimina expirados também na verificação horária da manutenção. Cópias anteriores seguem a retenção de backups.

Pesquisas são registradas após uma pausa na digitação ou uma ação na busca; prévias administrativas não geram visualizações. O histórico de orçamento nasce do preparo do resumo ou do clique no orçamento direto do produto, sempre como **preparado**, sem afirmar envio, aprovação, pedido ou pagamento. O servidor recalcula e valida os itens ao guardar o resumo e não aceita preços fornecidos pelo navegador. Tiragens livres do orçamento direto ficam sem preço de referência. Os valores históricos não são propostas atualizadas; novas condições precisam ser conferidas no catálogo.

### Privacidade, atendimento e retorno das ações

O contato direto por e-mail fica em `/paginas/contato.html` e usa `POST /api/contato`. Campos: nome, e-mail para resposta, assunto e mensagem (10 a 3.000 caracteres). O Gmail autorizado envia para `EMAIL_CONTATO`, para o e-mail comercial em **Contatos e configurações** ou, como última alternativa, para `GMAIL_USUARIO`. O visitante não escolhe o destinatário; seu e-mail é usado em `Reply-To`, nunca como remetente da conta Google. O transporte HTTPS é compartilhado com a recuperação, sem copiar mensagens para o cliente nem gravá-las no banco. Confirmação só ocorre após o Gmail aceitar o envio; falhas mantêm o formulário e não simulam sucesso. Limites: cinco tentativas por IP em quinze minutos e trinta tentativas globais por hora, além de campo antispam. Contadores ficam na memória do processo. As credenciais continuam exclusivamente no servidor; `EMAIL_CONTATO` também entra nas cópias privadas quando estiver configurado.

A página `/paginas/privacidade.html`, acessível pelo rodapé, cadastro e Minha conta, explica os dados usados para autenticação, recuperação, carrinho, preferências e backups. Os textos personalizados em **Contatos e configurações → Privacidade** continuam disponíveis. O formulário prepara solicitações de ajuda, acesso, correção ou exclusão para os canais existentes da gráfica; prioriza `contato_privacidade` quando for um e-mail válido, usa o e-mail comercial como alternativa e oferece o WhatsApp configurado. Não inventa endereço nem confirma envio ou exclusão automática: o titular confere e envia a mensagem no aplicativo escolhido, e a equipe atende o pedido. A orientação sobre direitos aponta para a [ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares).

Adicionar ao carrinho, reconhecer configuração já adicionada, atualizar, remover e limpar mostram mensagens claras. A confirmação de inclusão oferece acesso direto ao carrinho. Formulários e botões indicam processamento e bloqueiam cliques repetidos; erros de carregamento do produto oferecem nova tentativa. Os avisos usam os temas do site e nomes acessíveis. Mensagens de orçamento e atendimento continuam sendo rascunhos até envio confirmado pelo usuário no aplicativo externo.

### Verificações de contas

`npm test` cobre migração com dados existentes, cadastro e duplicação, normalização, limite de bytes do bcrypt, tentativa de elevação de privilégios, isolamento entre clientes e equipe (inclusive HTML administrativo codificado), CSRF, alteração de nome e senha, revogação e expiração de sessões, logout, limites de tentativas, link expirado e reutilizado, compatibilidade da recuperação administrativa e regressões do catálogo/carrinho/painel. O transporte de e-mail é interceptado somente no teste automatizado; entrega externa real exige configurar o provedor e verificar a caixa de entrada.
