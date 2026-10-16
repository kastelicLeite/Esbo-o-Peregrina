# Gráfica Peregrina

Landing page estática, sem dependências externas, cadastro ou rastreamento. O servidor Node entrega apenas os arquivos da pasta `frontend/`; não há API ou banco de dados. A prévia inicial foi publicada pelo Sites, sem alteração do domínio da empresa.

## Estrutura

- `frontend/index.html`: estrutura, conteúdo e metadados.
- `frontend/css/principal.css`: entrada dos estilos, separados em `base/`, `componentes/`, `layout/` e `paginas/`. As adaptações de tela ficam junto das regras de cada responsabilidade.
- `frontend/js/configuracao.js`: telefone confirmado pelo responsável, mensagens, catálogo e caminhos de fotos e logo.
- `frontend/js/principal.js`: apresentação do catálogo e links para WhatsApp.
- `frontend/assets/imagens/`: logo oficial e futuras fotos de produtos.
- `scripts/servidor-local.cjs`: servidor de arquivos estáticos para revisão local e hospedagem no Railway.
- `package.json`: comando de inicialização e versão do Node.
- `railway.json`: inicialização e verificação de disponibilidade no Railway.

Execute `npm start` e abra http://127.0.0.1:4173 para revisar. Encerre com Ctrl+C. Não é necessário instalar pacotes ou compilar. A pasta `frontend/` é a raiz pública; as configurações, este README e os scripts do servidor não são servidos aos visitantes. O domínio previsto é graficaperegrina.com.br; canonical e demais metadados dependentes da URL devem ser definidos quando o endereço de publicação estiver confirmado.

## Railway

Conecte o repositório GitHub a um serviço no Railway, mantendo a raiz do repositório como diretório do serviço. O comando `npm start` e a verificação em `/` estão definidos em `railway.json`. O servidor utiliza a porta `PORT` fornecida pela plataforma e escuta em `0.0.0.0` quando essa variável está definida. Depois do deploy, gere um domínio na área de rede pública do serviço para compartilhar a prévia. Não é necessário configurar o domínio da empresa.

## Imagens e identidade pendentes

A logo oficial fornecida está em `frontend/assets/imagens/logo-peregrina.png`, incorporada ao cabeçalho sem alteração do arquivo, das cores ou das proporções. As capturas do site anterior e fotografias dos produtos continuam pendentes. O acesso ao endereço anterior pela ferramenta de consulta não foi possível. Os painéis tipográficos são espaços reservados, não fotografias nem amostras de trabalhos realizados. Substitua-os antes da publicação pelas imagens aprovadas e com direitos de uso comercial.

Para usar a logo, defina `configuracao.logo` com o caminho local; a aplicação mantém sua proporção e não aplica recoloração. Para produtos, defina `foto` em cada item. Use WebP/AVIF otimizados com enquadramento revisado; as imagens do catálogo carregam sob demanda. A abertura usa apresentação textual e navegação direta para o catálogo, sem painel decorativo. Não foram usados recursos externos ou imagens de terceiros.

## Contato

WhatsApp confirmado nesta conversa: +55 (11) 91111-6541. O número e as mensagens estão centralizados em `frontend/js/configuracao.js`. Cada produto prepara sua própria mensagem. O visitante revisa e envia no WhatsApp; o site não envia pedidos automaticamente.

Não foram incluídos endereço, horários, prazos, preços ou outros dados comerciais sem confirmação.

## Verificação

Sintaxe JavaScript, seis produtos, número do WhatsApp, mensagens individuais e âncoras internas verificados automaticamente. O servidor iniciou, mas a checagem HTTP foi bloqueada pelas permissões de acesso a sockets do ambiente. A prévia no navegador integrado não conseguiu alcançar o servidor local (timeout); revisão visual em celular, tablet e computador, navegação real por teclado e abertura do aplicativo WhatsApp permanecem para validação manual. Os links foram verificados como URLs, sem envio de mensagens.

