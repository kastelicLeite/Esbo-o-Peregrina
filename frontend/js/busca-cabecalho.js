import { pesquisarProdutos } from './pesquisa-produtos.js';
import { registrarAtividade } from './historico/cliente.js';

const formulario = document.querySelector('.busca-cabecalho');
const campo = formulario?.querySelector('input[type="search"]');

if (campo) {
  const painel = document.createElement('div');
  painel.className = 'sugestoes-busca';
  painel.id = 'sugestoes-cabecalho';
  painel.hidden = true;
  painel.setAttribute('aria-label', 'Sugestões de produtos');
  campo.setAttribute('aria-controls', painel.id);
  painel.setAttribute('role', 'region');
  const estado = document.createElement('span');
  estado.className = 'somente-leitor';
  estado.setAttribute('role', 'status');
  estado.setAttribute('aria-live', 'polite');
  formulario.append(estado);
  formulario.append(painel);
  let consulta;
  let versao = 0;

  function fechar() {
    versao += 1;
    painel.hidden = true;
    estado.textContent = '';
  }

  async function sugerir() {
    const atual = ++versao;
    const termo = campo.value.trim().toLocaleLowerCase('pt-BR');
    if (!termo) {
      painel.hidden = true;
      return;
    }
    try {
      consulta ||= fetch('/api/produtos', { cache: 'no-store' }).then((resposta) => {
        if (!resposta.ok) throw new Error('Catálogo indisponível.');
        return resposta.json();
      }).catch((erro) => { consulta = null; throw erro; });
      const produtos = await consulta;
      if (atual !== versao) return;
      painel.replaceChildren();
      const encontrados = pesquisarProdutos(produtos, termo);
      for (const produto of encontrados.slice(0, 5)) {
        const link = document.createElement('a');
        link.className = 'sugestao-produto';
        link.href = `/paginas/produto.html?produto=${encodeURIComponent(produto.slug)}`;
        if (produto.imagem) {
          const imagem = document.createElement('img');
          imagem.src = produto.imagem.miniatura;
          imagem.alt = '';
          imagem.width = 44;
          imagem.height = 44;
          link.append(imagem);
        }
        const texto = document.createElement('span');
        texto.textContent = produto.nome;
        link.append(texto);
        painel.append(link);
      }
      if (!encontrados.length) {
        const aviso = document.createElement('p');
        aviso.textContent = 'Nenhum produto encontrado.';
        aviso.setAttribute('role', 'status');
        painel.append(aviso);
      }
      const todos = document.createElement('a');
      todos.className = 'ver-resultados-busca';
      todos.href = `/paginas/produtos.html?q=${encodeURIComponent(campo.value.trim())}`;
      todos.textContent = 'Ver resultados no catálogo';
      painel.append(todos);
      painel.hidden = false;
      estado.textContent = encontrados.length
        ? `${Math.min(encontrados.length, 5)} sugestões de produtos. Use a seta para baixo para navegar ou Enter para pesquisar.`
        : 'Nenhum produto encontrado. Pressione Enter para pesquisar no catálogo.';
    } catch {
      if (atual === versao) painel.hidden = true;
    }
  }

  campo.addEventListener('input', sugerir);
  campo.addEventListener('focus', sugerir);
  const registrarPesquisa = () => registrarAtividade('pesquisa', { termo: campo.value });
  formulario.addEventListener('submit', registrarPesquisa);
  painel.addEventListener('click', evento => { if (evento.target.closest('a')) registrarPesquisa(); });
  formulario.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !painel.hidden) {
      evento.preventDefault();
      campo.focus();
      fechar();
    }
    if (evento.target === campo && evento.key === 'ArrowDown' && !painel.hidden) {
      evento.preventDefault();
      painel.querySelector('a')?.focus();
    }
    if (painel.contains(evento.target) && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evento.key)) {
      evento.preventDefault();
      const links = [...painel.querySelectorAll('a')];
      const indice = links.indexOf(evento.target);
      if (evento.key === 'ArrowUp' && indice === 0) campo.focus();
      else {
        const destino = evento.key === 'Home' ? 0 : evento.key === 'End' ? links.length - 1
          : Math.max(0, Math.min(links.length - 1, indice + (evento.key === 'ArrowDown' ? 1 : -1)));
        links[destino]?.focus();
      }
    }
  });
  formulario.addEventListener('focusout', (evento) => {
    if (!formulario.contains(evento.relatedTarget)) fechar();
  });
  document.addEventListener('pointerdown', (evento) => {
    if (!formulario.contains(evento.target)) fechar();
  });
  formulario.addEventListener('submit', fechar);
}
