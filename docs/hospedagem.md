# Planejamento de hospedagem

## Preparação atual — 08/11/2026

O site está em teste local por túnel. O serviço anterior no Railway foi retirado do ar. Esta preparação não contrata serviços, não publica o site e não altera DNS. As seções abaixo sobre publicações anteriores são histórico.

### Armazenamento persistente

Use uma única instância Node.js 24 e um volume persistente montado em `/data`: SQLite em `/data/peregrina.sqlite`, imagens em `/data/imagens` e backups locais em `/data/backups`. Não guarde esses arquivos no disco temporário do contêiner nem dentro de `frontend`. Não escale horizontalmente este projeto com SQLite.

O `compose.yaml` fornece volume nomeado `dados-peregrina`, reinício automático, encerramento controlado e porta publicada somente em `127.0.0.1:3000`. Um proxy HTTPS deve encaminhar as requisições a essa porta. O volume permanece ao recriar o contêiner; `docker compose down -v` apaga o volume e não deve ser usado para atualizar o site.

Antes de iniciar em hospedagem nova:

1. Configure `.env` ou as variáveis privadas: `URL_PUBLICA=https://seu-dominio`, `NODE_ENV=production`, `HOST=0.0.0.0`, `PASTA_DADOS=/data` e `PASTA_BACKUPS=/data/backups`.
2. Configure `CONFIAR_PROXY` conforme a cadeia real de proxies. No Compose, a porta fica restrita ao host; com um único proxy HTTPS confiável, use `1`. Não exponha a porta diretamente à internet com confiança irrestrita de proxy.
3. Monte o volume e confira as permissões de leitura e escrita. Em serviços gerenciados, confirme que o plano preserva o disco em reinícios e atualizações.
4. Restaure uma cópia íntegra do banco e imagens usando os comandos de [backup](backup.md), com o servidor parado. Não copie apenas o SQLite enquanto ele estiver sendo usado.
5. Confira produtos, contas e imagens. Recrie o serviço e confira os mesmos registros para validar a persistência. Não cadastre dados fictícios no catálogo real para esse teste.
6. Configure Gmail no ambiente privado. Nunca envie `.env`, `dados` ou backups ao GitHub.

### Backup fora do servidor

A integração com armazenamento privado compatível com S3 permanece desativada até ser configurada. Ela criptografa os pacotes antes de enviar, lê de volta para conferir tamanho e SHA-256 e mantém a cópia local em caso de falha. Consulte [configuração e recuperação](backup.md#backup-externo).

### Monitoramento de disponibilidade

`GET /saude` retorna `200 {"status":"ok"}` quando o banco responde, a pasta de imagens aceita escrita e há pelo menos 50 MB livres no volume. Retorna `503 {"status":"indisponivel"}` em caso de falha, sem revelar caminhos ou credenciais. Os resultados são reutilizados por até cinco segundos.

O Docker tem `HEALTHCHECK` a cada 30 segundos e `railway.json` aponta para `/saude`. O Compose reinicia um processo encerrado; o estado “unhealthy” sozinho não reinicia automaticamente o contêiner. Essa rota não confirma funcionamento de e-mail ou backup externo: confira seus estados no painel.

Para alertas fora do servidor, configure um monitor HTTP no serviço de sua escolha: URL `https://seu-dominio/saude`, intervalo de um minuto e alerta após duas ou três falhas. Configure os destinatários na conta do monitor. Não forneça senha do painel ou tokens. A rota está pronta; nenhum monitor externo foi contratado ou ativado.

### Validação antes da publicação

Execute `npm test`. Na hospedagem, confira saúde, HTTPS, e-mail, catálogo, carrinho, persistência após recriação e restauração em uma pasta separada. O build Docker depende de Docker instalado no ambiente. Publicação final, domínio, armazenamento externo e conta de monitoramento ainda precisam de configuração.

## Atualização em 25/10/2026

O usuário solicitou a publicação no Railway. Essa solicitação substitui a orientação anterior de manter o site somente local. Não houve autorização para contratar planos ou alterar o DNS do domínio comprado.

A publicação foi preparada com Docker/Node.js 24 e exclusão de arquivos privados do envio do código. Após renovar o login do Railway, o código foi publicado e os dados foram importados com autorização explícita do usuário.

### Situação após autenticação

- A autenticação foi concluída e o código foi enviado ao serviço existente `Esbo-o-Peregrina`, projeto `devoted-mindfulness`, ambiente `production`.
- Endereço: https://esbo-o-peregrina-production.up.railway.app
- Volume de 500 MB montado em `/data`; aplicação em Node.js 24, uma instância.
- O código responde por HTTPS e as rotas privadas continuam protegidas. A publicação foi concluída com 44 produtos, 238 arquivos de imagens e 2 contas.
- Após o bloqueio inicial pela revisão automática, o usuário autorizou explicitamente transferir os dados e contas atuais, incluindo nome, e-mail, hash da senha, permissões e histórico, ao volume privado do Railway.
- A cópia consistente preparada em `dados/publicacao-railway/` foi importada em transação, após confirmar que o banco remoto estava vazio. Ela não contém sessões nem links de recuperação. Nunca enviar essa pasta como parte do código público ou da imagem Docker.
- As contas remotas foram comparadas com a cópia autorizada, sem exibir seus dados ou hashes. A conta ID 2 manteve o perfil Criador protegido.
- Foram verificados os 236 endereços de imagens usados no catálogo público, sem falhas. Banco, contas e imagens permaneceram após reiniciar o serviço; verificação de integridade do SQLite retornou `ok`.
- A pasta temporária `/data/importacao` foi removida após a importação. O banco principal fica em `/data/peregrina.sqlite`, e as imagens em `/data/imagens`. Uma cópia do banco remoto inicialmente vazio foi preservada em `/data/antes-importacao-vazia.sqlite`.
- A chave SSH temporária de transferência foi revogada e os arquivos locais da chave foram removidos ao concluir.
- Não foi alterado o DNS do domínio comprado nem configurado o provedor de e-mail.
- Foram corrigidas duas dependências com `npm audit fix`; auditoria sem vulnerabilidades e 47 testes aprovados após a atualização.
- O Railway avisou que `railway.json` é um formato descontinuado aceito até 01/12/2026. Migrar a configuração para o formato indicado pela plataforma antes desse prazo para futuras publicações.

Configuração prevista:

- Criar ou selecionar o serviço correto no Railway e montar um volume persistente em `/data`.
- Definir `NODE_ENV=production`, `HOST=0.0.0.0`, `PASTA_DADOS=/data` e `CONFIAR_PROXY=1` para o proxy da plataforma.
- Manter uma única instância da aplicação usando SQLite.
- Transferir uma cópia consistente do banco e das imagens para o volume privado, sem incluir sessões locais, links de recuperação, backups ou o arquivo de PID.
- Gerar o endereço HTTPS do Railway e configurar `URL_PUBLICA` para esse endereço.
- Configurar o provedor de e-mail separadamente, se as credenciais estiverem disponíveis.
- Verificar catálogo, imagens, HTTPS, persistência e proteção do painel após a publicação.

O arquivo de PID fica no diretório temporário do contêiner no Railway, evitando reutilizar no volume um PID de uma execução anterior. Localmente, permanece em `dados/servidor.pid`.

Registrado em 23/10/2026.

## Situação

- O usuário já comprou um domínio.
- O usuário não quer publicar o site agora. Esta conversa não autoriza contratar serviços, publicar ou alterar DNS.
- A empresa do domínio e a existência de uma hospedagem contratada ainda não foram confirmadas.

## Requisitos do projeto

- Node.js 24 com Express.
- Armazenamento persistente para o SQLite e as imagens enviadas pelo painel.
- Domínio próprio, HTTPS, backups e configuração do provedor de e-mail para recuperação de senha.

## Comparação discutida

- A recomendação apresentada foi Render pago com disco persistente, pela facilidade de operação. O usuário pediu para guardar a comparação; não confirmou uma compra ou escolha definitiva.
- Hostinger VPS foi apresentada como alternativa com mais recursos pelo valor, exigindo administração do servidor, atualizações e segurança.
- Para Hostinger Node.js gerenciada, confirmar com o suporte a persistência do SQLite e dos uploads após atualizações antes de contratar. Essa compatibilidade não foi confirmada.
- Valores consultados na data: Render básico US$ 7/mês mais disco; Hostinger VPS KVM 1 R$ 29,99/mês promocional e renovação anunciada de R$ 59,99/mês, sujeitos às condições e ao período contratado.
- Conferir novamente preços, impostos, condições de renovação, versões e recursos antes de qualquer contratação.

## Referências

- Render: https://render.com/pricing
- Discos persistentes: https://render.com/docs/disks
- Hostinger VPS: https://www.hostinger.com/br/servidor-vps
- Hostinger Node.js: https://www.hostinger.com/br/nodejs-hosting
