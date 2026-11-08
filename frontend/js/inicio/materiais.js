export const materiais = [
  { nome: 'Cartões de visita', categoria: 'cartoes-de-visita', icone: 'cartao',
    texto: 'Um primeiro contato com a identidade da sua marca.',
    detalhes: ['Opções de papel e gramatura', 'Impressão e acabamento', 'Escolha a tiragem no catálogo'] },
  { nome: 'Adesivos', categoria: 'adesivos', icone: 'adesivo',
    texto: 'Para identificar, decorar e levar sua marca a mais lugares.',
    detalhes: ['Diferentes aplicações', 'Tamanhos e materiais', 'Personalização com a sua arte'] },
  { nome: 'Wind banners', categoria: 'wind-banners', icone: 'bandeira',
    texto: 'Dê destaque à sua marca em eventos, fachadas e ações promocionais.',
    detalhes: ['Formatos para sua comunicação', 'Impressão personalizada', 'Consulte a composição do kit'] },
  { nome: 'Panfletos e flyers', categoria: 'panfletos', icone: 'folha',
    texto: 'Sua campanha, seu lançamento ou sua oferta na mão do cliente.',
    detalhes: ['Opções de tamanho', 'Frente ou frente e verso', 'Tiragens para sua divulgação'] },
  { nome: 'Sacolas personalizadas', categoria: 'sacolas', icone: 'sacola',
    texto: 'Uma embalagem que acompanha o produto e apresenta sua marca.',
    detalhes: ['Papéis e tamanhos variados', 'Opções de alça', 'Impressão personalizada'] },
  { nome: 'Agendas e cadernos', categoria: 'agendas-e-cadernos', icone: 'caderno',
    texto: 'Organização para o dia a dia e presença de marca em cada página.',
    detalhes: ['Capas personalizadas', 'Modelos para empresas', 'Consulte miolos e acabamentos'] },
  { nome: 'Apostilas', categoria: 'apostilas', icone: 'caderno',
    texto: 'Conteúdo organizado para cursos, treinamentos e apresentações.',
    detalhes: ['Formato para seu conteúdo', 'Impressão do miolo e da capa', 'Consulte a encadernação'] },
  { nome: 'Banners e lonas', categoria: 'banners', icone: 'banner',
    texto: 'Mais espaço para comunicar sua ideia e destacar sua mensagem.',
    detalhes: ['Medidas e aplicações', 'Opções de acabamento', 'Materiais para divulgação'] },
  { nome: 'Blocos e talões', pesquisa: 'bloco', icone: 'folha',
    texto: 'Materiais para organizar pedidos, registros e a rotina da empresa.',
    detalhes: ['Personalização do layout', 'Consulte vias e numeração', 'Formato adequado ao seu uso'] },
  { nome: 'Cardápios', pesquisa: 'cardápio', icone: 'folha',
    texto: 'Apresente seus produtos com uma comunicação que combina com seu negócio.',
    detalhes: ['Layout com a sua identidade', 'Consulte materiais e formatos', 'Acabamentos para seu projeto'] },
  { nome: 'Crachás e brindes', categoria: 'brindes-personalizados', icone: 'cracha',
    texto: 'Identificação e lembranças que levam sua marca para o dia a dia.',
    detalhes: ['Canetas e outros brindes', 'Cordões personalizados', 'Opções para empresas e eventos'] },
  { nome: 'Papelaria corporativa', pesquisa: 'papelaria', icone: 'envelope',
    texto: 'A identidade da empresa também está nos detalhes da sua comunicação.',
    detalhes: ['Consulte timbrados e envelopes', 'Materiais com sua marca', 'Projetos para sua rotina'] },
];

const desenhos = {
  cartao: 'M3 5h18v14H3z M6 9h4 M6 13h7 M16 9h2',
  adesivo: 'M5 3h14v11l-7 7H5z M12 21v-7h7',
  bandeira: 'M5 22V2c12 0 16 4 7 10H5 M2 22h8',
  folha: 'M6 2h9l4 4v16H6z M14 2v5h5 M9 12h7 M9 16h7',
  sacola: 'M4 7h16l-2 15H6z M8 7V5a4 4 0 0 1 8 0v2',
  caderno: 'M6 3h14v18H6z M3 6h5 M3 11h5 M3 16h5 M11 8h5',
  banner: 'M3 4h18v12H3z M7 16v5 M17 16v5 M6 8h12 M6 12h7',
  cracha: 'M5 5h14v17H5z M9 2h6 M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6 M8 19c0-4 8-4 8 0',
  envelope: 'M3 5h18v14H3z M3 5l9 7l9-7',
};

export function montarMateriais() {
  const lista = document.querySelector('#materiais-inicio');
  for (const [indice, item] of materiais.entries()) {
    const cartao = document.createElement('article');
    cartao.className = `material-inicio cor-material-${indice % 4}`;
    const icone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icone.setAttribute('viewBox', '0 0 24 24');
    icone.setAttribute('aria-hidden', 'true');
    const desenho = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    desenho.setAttribute('d', desenhos[item.icone]);
    icone.append(desenho);
    const titulo = document.createElement('h3');
    const parametros = new URLSearchParams(item.categoria
      ? { categoria: item.categoria } : { q: item.pesquisa });
    const catalogo = document.createElement('a');
    catalogo.className = 'link-catalogo-material';
    catalogo.href = `/paginas/produtos.html?${parametros}`;
    catalogo.textContent = item.nome;
    catalogo.setAttribute('aria-label', `Ver produtos de ${item.nome}`);
    titulo.append(catalogo);
    const texto = document.createElement('p');
    texto.textContent = item.texto;
    const detalhes = document.createElement('ul');
    for (const linha of item.detalhes) {
      const detalhe = document.createElement('li');
      detalhe.textContent = linha;
      detalhes.append(detalhe);
    }
    const link = document.createElement('a');
    link.className = 'link-material';
    link.href = '#contato';
    link.dataset.materialOrcamento = item.nome;
    link.textContent = 'Pedir orçamento →';
    link.setAttribute('aria-label', `Pedir orçamento de ${item.nome}`);
    cartao.append(icone, titulo, texto, detalhes, link);
    lista.append(cartao);
  }
}
