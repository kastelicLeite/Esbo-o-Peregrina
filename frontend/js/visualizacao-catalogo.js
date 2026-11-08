const controles = document.querySelector('.visualizacao-catalogo');
const lista = document.querySelector('#catalogo-produtos');

if (controles && lista) {
  const botoes = controles.querySelectorAll('[data-visualizacao]');

  function aplicar(modo) {
    const visualizacao = ['grade', 'compacta', 'lista'].includes(modo) ? modo : 'grade';
    lista.dataset.visualizacao = visualizacao;
    botoes.forEach((botao) => {
      botao.setAttribute('aria-pressed', String(botao.dataset.visualizacao === visualizacao));
    });
  }

  aplicar('grade');
  controles.hidden = false;

  botoes.forEach((botao) => botao.addEventListener('click', () => {
    aplicar(botao.dataset.visualizacao);
  }));
}
