# Acessibilidade

As páginas públicas, de conta e do painel oferecem um atalho **Pular para o conteúdo** no início da navegação por teclado. Use Tab e Shift+Tab para percorrer os controles e Enter ou Espaço conforme o controle. O foco fica visível nos campos, botões, links e opções.

Na busca, Seta para baixo entra nas sugestões. Setas para cima e para baixo percorrem os links; Home e End vão às extremidades. Escape fecha as sugestões e devolve o foco à busca. O cabeçalho volta a aparecer quando recebe foco, mesmo depois de oculto pela rolagem.

As janelas de produto e do painel usam o diálogo nativo do navegador, com título e botão de fechar. Escape fecha a janela e o foco retorna ao controle de origem, quando ainda disponível. Os formulários do painel verificam os campos antes de enviar e direcionam o foco à mensagem quando o servidor rejeita uma operação.

A galeria tem controles de imagem anterior, próxima e **Pausar troca de fotos**. A troca automática para durante o foco de teclado ou a presença do ponteiro e inicia pausada quando o navegador prefere movimento reduzido. O usuário pode retomá-la explicitamente. O site também reduz animações e transições conforme essa preferência.

Na biblioteca, abra o lápis de uma imagem e preencha **Descrição da imagem para acessibilidade**. Descreva o conteúdo relevante da foto, sem repetir “imagem de” nem inventar informações. A descrição acompanha seus vínculos no site. Nome de arquivo ou “foto do produto” não substituem uma descrição útil. Os arquivos reais precisam ser revisados pela equipe; o sistema não inventa descrições automaticamente.

## Verificação

`npm test` inclui verificações de idioma e título, rótulos de campos, referências acessíveis, atalhos, IDs únicos, alternativas das imagens estáticas, contraste das cores principais e das bordas dos campos nos dois temas, além de pausa e teclado da galeria. As cores verificadas atingem razão mínima de 4,5:1 para texto e 3:1 para as bordas dos campos.

Essas verificações não certificam conformidade integral. A inspeção visual e o uso de um leitor de tela real não estavam disponíveis nesta sessão. Para a conferência manual, use teclado e NVDA ou VoiceOver nos fluxos de busca, escolha de produto, carrinho, cadastro, recuperação e painel. Confira zoom de 200%, alto contraste, movimento reduzido e ambos os temas. Revise as descrições das fotos existentes pela biblioteca.
