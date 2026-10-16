# Gráfica Peregrina

Landing page estática, sem dependências, backend, cadastro ou rastreamento. Não publicada; nenhuma alteração de domínio, DNS ou hospedagem.

## Estrutura

- `frontend/index.html`: estrutura, conteúdo e metadados.
- `frontend/css/principal.css`: entrada dos estilos, separados em `base/`, `componentes/`, `layout/` e `paginas/`. As adaptações de tela ficam junto das regras de cada responsabilidade.
- `frontend/js/configuracao.js`: telefone confirmado pelo responsável, mensagens, catálogo e caminhos de fotos e logo.
- `frontend/js/principal.js`: apresentação do catálogo e links para WhatsApp.
- `frontend/assets/imagens/`: logo oficial e futuras fotos de produtos.
- `scripts/servidor-local.cjs`: ferramenta de revisão local; serve apenas a pasta `frontend/`.

Execute `node scripts/servidor-local.cjs` e abra http://127.0.0.1:4173 para revisar. Encerre com Ctrl+C. Sirva a pasta por HTTP para executar os módulos JavaScript. Não é necessário instalar pacotes ou compilar. O servidor é apenas para revisão local, não para hospedagem pública. Para hospedagem estática futura, use `frontend/` como raiz pública e envie seu conteúdo preservando os caminhos relativos. A pasta `scripts/` e este README ficam fora da raiz pública. O domínio previsto é graficaperegrina.com.br; canonical e demais metadados dependentes da URL devem ser definidos quando o endereço de publicação estiver confirmado.

## Imagens e identidade pendentes

A logo oficial fornecida está em `frontend/assets/imagens/logo-peregrina.png`, incorporada ao cabeçalho sem alteração do arquivo, das cores ou das proporções. As capturas do site anterior e fotografias dos produtos continuam pendentes. O acesso ao endereço anterior pela ferramenta de consulta não foi possível. Os painéis tipográficos são espaços reservados, não fotografias nem amostras de trabalhos realizados. Substitua-os antes da publicação pelas imagens aprovadas e com direitos de uso comercial.

Para usar a logo, defina `configuracao.logo` com o caminho local; a aplicação mantém sua proporção e não aplica recoloração. Para produtos, defina `foto` em cada item. Use WebP/AVIF otimizados com enquadramento revisado; as imagens do catálogo carregam sob demanda. A abertura usa apresentação textual e navegação direta para o catálogo, sem painel decorativo. Não foram usados recursos externos ou imagens de terceiros.

## Contato

WhatsApp confirmado nesta conversa: +55 (11) 91111-6541. O número e as mensagens estão centralizados em `frontend/js/configuracao.js`. Cada produto prepara sua própria mensagem. O visitante revisa e envia no WhatsApp; o site não envia pedidos automaticamente.

Não foram incluídos endereço, horários, prazos, preços ou outros dados comerciais sem confirmação.

## Verificação

Sintaxe JavaScript, seis produtos, número do WhatsApp, mensagens individuais e âncoras internas verificados automaticamente. O servidor iniciou, mas a checagem HTTP foi bloqueada pelas permissões de acesso a sockets do ambiente. A prévia no navegador integrado não conseguiu alcançar o servidor local (timeout); revisão visual em celular, tablet e computador, navegação real por teclado e abertura do aplicativo WhatsApp permanecem para validação manual. Os links foram verificados como URLs, sem envio de mensagens.

