import { carregarSite, linkWhatsapp, configuracao } from './configuracao.js';

export async function atualizarSite(aplicarLanding = false) {
  const dados = await carregarSite();
  document.querySelectorAll('[data-orcamento]').forEach((link) => { link.href = linkWhatsapp(); });
  document.querySelectorAll('[data-instagram]').forEach((link) => {
    link.hidden = !configuracao.instagram;
    if (configuracao.instagram) {
      link.href = configuracao.instagram;
      link.querySelector('span').textContent = `Instagram · @${new URL(configuracao.instagram).pathname.split('/').filter(Boolean)[0] || 'graficaperegrina'}`;
    }
  });
  const telefone = document.querySelector('#telefone');
  if (telefone) {
    telefone.textContent = configuracao.telefone || '';
    telefone.href = linkWhatsapp();
    telefone.hidden = !configuracao.telefone;
  }

  if (aplicarLanding) {
    const secoes = dados.secoes.slice().sort((a, b) => a.posicao - b.posicao);
    const principal = document.querySelector('main');
    for (const item of secoes) {
      const secao = document.getElementById(item.id);
      if (!secao) continue;
      secao.hidden = !item.visivel;
      const titulo = secao.querySelector('h1, h2');
      const texto = secao.querySelector('[data-texto-secao]');
      const chamada = secao.querySelector('[data-chamada-secao]');
      if (titulo) titulo.textContent = item.titulo;
      if (texto) texto.textContent = item.texto;
      if (chamada) {
        chamada.textContent = item.chamada;
        chamada.hidden = !item.chamada;
      }
      if (item.passos?.length) {
        secao.querySelectorAll('.passos li').forEach((linha, indice) => {
          if (!item.passos[indice]) return;
          linha.querySelector('h3').textContent = item.passos[indice].titulo;
          linha.querySelector('p').textContent = item.passos[indice].texto;
        });
      }
      secao.querySelector('.imagem-secao')?.remove();
      if (item.imagem) {
        const imagem = document.createElement('img');
        imagem.className = 'imagem-secao';
        imagem.src = item.imagem.url;
        imagem.alt = item.imagem.alternativo;
        imagem.width = item.imagem.largura;
        imagem.height = item.imagem.altura;
        imagem.loading = item.id === 'inicio' ? 'eager' : 'lazy';
        secao.append(imagem);
      }
      principal.append(secao);
      document.querySelectorAll('[data-apos-secao]').forEach((extra) => {
        if (extra.dataset.aposSecao === item.id) principal.append(extra);
      });
    }
    if (new URLSearchParams(location.search).get('previa') === '1') {
      const aviso = document.createElement('p');
      aviso.className = 'aviso-previa';
      aviso.textContent = 'Prévia da landing page — alterações ainda não publicadas.';
      principal.prepend(aviso);
    }
    if (location.hash) {
      const ancora = document.getElementById(location.hash.slice(1));
      if (ancora && principal.contains(ancora)) {
        requestAnimationFrame(() => ancora.scrollIntoView({ block: 'start', behavior: 'instant' }));
      }
    }
  }

  const areaContato = document.querySelector('#dados-contato');
  if (areaContato) {
    areaContato.replaceChildren();
    for (const [chave, rotulo] of [['email', 'E-mail'], ['endereco', 'Endereço'], ['horarios', 'Horários']]) {
      if (!configuracao[chave]) continue;
      const linha = document.createElement('p');
      linha.textContent = `${rotulo}: ${configuracao[chave]}`;
      areaContato.append(linha);
    }
    for (const chave of ['instagram', 'facebook']) {
      if (!configuracao[chave]) continue;
      const link = document.createElement('a');
      link.className = 'link-texto';
      link.href = configuracao[chave];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = chave === 'instagram' ? 'Instagram' : 'Facebook';
      if (chave === 'instagram') {
        link.classList.add('contato-instagram');
        const logo = document.createElement('img');
        logo.src = '/assets/imagens/instagram.png';
        logo.alt = '';
        logo.width = 20;
        logo.height = 20;
        link.prepend(logo);
      }
      areaContato.append(link);
    }
  }

  document.querySelector('#privacidade-publica')?.remove();
  if (configuracao.privacidade || configuracao.contato_privacidade) {
    const detalhes = document.createElement('details');
    detalhes.id = 'privacidade-publica';
    const titulo = document.createElement('summary');
    titulo.textContent = 'Informações adicionais de privacidade';
    const texto = document.createElement('p');
    texto.textContent = [configuracao.privacidade, configuracao.contato_privacidade].filter(Boolean).join('\n\n');
    detalhes.append(titulo, texto);
    document.querySelector('[data-privacidade-rodape]')?.append(detalhes);
  }
  return dados;
}
