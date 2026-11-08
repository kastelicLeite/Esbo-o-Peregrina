# Backup e restauração

## Backup externo

Além das cópias locais, o projeto pode enviar pacotes a um armazenamento privado compatível com S3. Esse espaço é separado do servidor do site. Nenhum envio acontece enquanto `BACKUP_EXTERNO_ATIVO` não for `1` e as configurações não estiverem completas.

Configure nas variáveis privadas do servidor:

```dotenv
BACKUP_EXTERNO_ATIVO=1
BACKUP_S3_ENDPOINT=https://endpoint-do-provedor
BACKUP_S3_BUCKET=nome-do-bucket-privado
BACKUP_S3_REGIAO=auto
BACKUP_S3_PREFIXO=peregrina
BACKUP_S3_ACCESS_KEY_ID=chave-de-acesso
BACKUP_S3_SECRET_ACCESS_KEY=segredo-de-acesso
BACKUP_CHAVE_CRIPTOGRAFIA=chave-aleatoria-de-32-bytes-em-base64
```

Os valores são exemplos, não credenciais reais. Use a região indicada pelo provedor. O bucket deve ter acesso público desabilitado; a credencial deve permitir apenas gravar e ler os objetos do prefixo escolhido. A integração não precisa de permissão para excluir objetos nem criar buckets. Use um prefixo exclusivo para este site e configure a retenção remota pelo próprio provedor: a retenção local não apaga cópias externas.

Gere a chave de criptografia no terminal privado com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Guarde essa chave também em um local seguro separado do servidor e dos backups. Sem a chave correta não é possível recuperar a cópia externa. Ao trocar a chave, preserve as anteriores para ler os arquivos antigos.

O pacote é criptografado com AES-256-GCM antes de sair do servidor. O envio usa HTTPS e o SDK oficial S3. Após enviar, a aplicação lê o objeto remoto e compara o tamanho e o SHA-256 do arquivo criptografado. Só então marca a cópia como enviada. Em caso de erro, preserva o backup local e tenta novamente no ciclo de dez minutos. Cada ciclo processa até três cópias pendentes, das mais recentes para as antigas. Também tenta enviar depois de criar um novo backup.

Em **Histórico e manutenção → Backups**, apenas Criadores podem ver o estado externo de cada cópia, atualizar o estado e usar **Enviar cópias externas pendentes**. A Visão geral mostra o resumo para Criadores. As chaves nunca são devolvidas pela API. O serviço de armazenamento precisa ser escolhido e configurado; esta implementação não cria uma conta nem ativa envios por conta própria.

### Recuperar uma cópia externa

1. Baixe o arquivo `.tar.gz.enc` pelo console privado do armazenamento.
2. Configure `BACKUP_CHAVE_CRIPTOGRAFIA` com a chave usada naquele arquivo. Não coloque a chave no comando ou em mensagens.
3. Execute `npm run descriptografar-backup -- "COPIA.tar.gz.enc" "SAIDA.tar.gz"`. O destino precisa ser novo; arquivos existentes não são sobrescritos. Um arquivo adulterado ou uma chave errada faz a operação falhar e remove a saída incompleta.
4. Com o servidor parado, execute `npm run restaurar -- "SAIDA.tar.gz" --confirmar`. A restauração verifica banco e imagens e preserva uma cópia do estado anterior. Acrescente `--restaurar-ambiente` somente quando quiser recuperar também as variáveis incluídas no pacote.
5. Inicie o servidor, confira o catálogo e entre novamente. Faça primeiro um ensaio em uma pasta separada, sem substituir o banco real. O restaurador atual aceita pacotes compactados de até 256 MB; para volumes maiores, adapte e teste os limites antes de ampliar o catálogo.

Referência técnica: [exemplos oficiais do SDK S3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html).

## Cópias locais

O servidor cria backups automáticos diários e mantém as últimas sete cópias automáticas. A política pode ser alterada em **Painel → Histórico e manutenção → Backups** por uma conta **Criador**. Administradores e editores não podem baixar os pacotes completos, pois eles incluem contas, senhas protegidas e credenciais privadas.

Cada cópia inclui o banco SQLite, imagens e miniaturas, configurações do site, histórico, credenciais de recuperação e um manifesto SHA-256. Sessões, links e códigos de recuperação temporários são removidos somente da cópia; o site continua funcionando. O pacote é `backup.tar.gz`, sem criptografia: guarde-o em armazenamento privado. Ele não inclui o código do projeto, que precisa ser preservado separadamente.

## Backup automático e painel

- O agendamento começa com o servidor (`npm start` ou `iniciar-site.cmd`). Uma cópia vencida é criada cerca de cinco segundos após iniciar; depois, o servidor confere o prazo a cada hora. O horário pode atrasar até uma hora em relação ao intervalo escolhido.
- Se o computador estiver desligado, não há execução. Ao ligar o servidor novamente, o agendamento recupera a cópia vencida. O estado persiste em `dados/backups/agendamento.json`, não só na memória.
- É possível pausar o agendamento, escolher intervalos de 6, 12 ou 24 horas e manter de 1 a 30 cópias automáticas.
- Use **Criar backup agora**, **Verificar integridade** e **Baixar backup** no painel. Essas operações funcionam sem encerrar o site. Banco, imagens e pacote são montados de forma síncrona no mesmo processo, evitando alterações concorrentes da aplicação durante a cópia; o atendimento de outras requisições pode pausar brevemente.
- A retenção apaga somente pastas `automatico-*` gerenciadas por este sistema. Cópias manuais, importações e cópias anteriores à restauração são preservadas. Falhas aparecem no painel; uma cópia só é anunciada como concluída depois da validação do banco e dos arquivos.
- O padrão é `PASTA_DADOS/backups` (localmente `dados/backups/`). `PASTA_BACKUPS` permite escolher outro diretório privado, fora de `frontend/`. Mantenha o banco em uma única instância de servidor.
- Os pacotes contêm o `.env` local e as credenciais Gmail/Resend presentes no ambiente do processo. Não incluem variáveis internas da plataforma, credenciais SSH nem arquivos do sistema. Guardar backups no mesmo disco não protege contra perda desse disco: baixe uma cópia e mantenha-a em outro dispositivo ou armazenamento privado. Não há envio automático para nuvem configurado.

## Criar backup

1. Encerre o servidor e confirme que todas as instâncias foram paradas.
2. Execute `npm run backup`. O resultado será uma cópia manual em `dados/backups/`, com pacote `backup.tar.gz`, ignorada pelo Git e visível no painel.
3. Guarde uma cópia dessa pasta fora do computador ou volume que hospeda o site, incluindo `manifesto.json`, `banco.sqlite` e `imagens/`.

É possível indicar uma pasta nova: `npm run backup -- "C:\Backups\peregrina-2026-10-19"`.

O comando de terminal recusa a operação quando outro processo está usando o banco. Com o site ligado, use o painel, que cria a cópia no próprio processo do servidor.

## Restaurar

1. Use apenas backups confiáveis, produzidos por este projeto.
2. Encerre o servidor.
3. Execute `npm run restaurar -- "CAMINHO_DO_BACKUP.tar.gz" --confirmar`. Pastas de backups anteriores também são aceitas.
4. O procedimento recusa caminhos não permitidos, links e arquivos acima dos limites de extração, confere SHA-256, integridade e vínculos do banco. Antes de substituir os dados, preserva uma cópia do estado atual em `dados/backups/antes-restauracao-*`.
5. Reinicie com `npm start` ou `iniciar-site.cmd` e entre novamente no painel. As sessões e os links antigos de recuperação são invalidados.
6. Confira catálogo e imagens. Se necessário, restaure a cópia anterior pelo mesmo procedimento.

As credenciais e a configuração `.env` atuais são preservadas por padrão. Para restaurá-las também, acrescente **`--restaurar-ambiente`** ao comando. Ajuste endereço, pasta de dados e porta se mudar de máquina. Backups antigos sem `ambiente.env` continuam válidos. O pacote de restauração tem limite de 256 MB comprimido, 512 MB extraído e 30 mil entradas; arquivos de versões maiores precisam de procedimento de manutenção específico.

## Hospedagem futura

No Railway, monte um volume persistente e defina `PASTA_DADOS` apontando para ele. Banco e imagens ficam juntos nessa pasta. O servidor deve usar uma única instância; não duplique réplicas sobre o mesmo arquivo SQLite. Arquivos fora de volume persistente podem se perder em novos deploys.

O agendamento funciona também em hospedagem enquanto o processo estiver ativo. Configure uma pasta persistente (por exemplo `PASTA_BACKUPS=/data/backups`). A restauração exige o servidor parado. Guarde cópias fora do volume; o agendamento local não substitui uma cópia externa.
# Importação do Railway em 08/11/2026

O projeto local recebeu uma cópia consistente do SQLite e das imagens do serviço Railway: 46 produtos, 15 categorias, 2 contas, 123 registros de imagem (246 arquivos contando miniaturas), 75 variações e o histórico existente. Os hashes das senhas e os perfis foram preservados. A restauração acrescentou seu próprio registro de manutenção ao histórico.

Os dados ativos ficam em `dados/peregrina.sqlite` e `dados/imagens/`. As quatro credenciais Gmail foram copiadas para `.env`, com endereço, porta e pasta de dados ajustados para execução local. Banco, imagens, credenciais e backups estão excluídos do Git e dos pacotes de publicação. Não publicar essas pastas nem compartilhar `.env`.

A cópia anterior ficou em `backups/antes-restauracao-1794161391776/`, incluindo o ambiente local anterior. O pacote recebido e o manifesto de integridade estão em `dados/importacao-railway-1794161338598/`. As tabelas foram comparadas com o snapshot e os arquivos de imagens conferidos por SHA-256. A aplicação local foi verificada sem enviar e-mails reais. Sessões e recuperações temporárias da cópia foram limpas; os usuários devem entrar novamente com suas senhas habituais. O serviço e os dados do Railway permanecem ativos e não foram apagados.

