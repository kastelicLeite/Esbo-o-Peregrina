const categorias = [
  ['Adesivos', 'adesivos'],
  ['Wind banners', 'wind-banners'],
  ['Panfletos', 'panfletos'],
  ['Sacolas', 'sacolas'],
  ['Agendas e cadernos', 'agendas-e-cadernos'],
  ['Apostilas', 'apostilas'],
];

const configuracoes = {
  whatsapp: '5511911116541',
  telefone: '+55 (11) 91111-6541',
  email: '',
  endereco: '',
  horarios: '',
  instagram: '',
  facebook: '',
  mensagem: 'Olá! Gostaria de solicitar um orçamento com a Gráfica Peregrina.',
  mensagem_produto: 'Olá! Gostaria de um orçamento para {produto}.',
  titulo: 'Gráfica Peregrina | Impressos e orçamento pelo WhatsApp',
  descricao: 'Conheça os produtos da Gráfica Peregrina e solicite um orçamento pelo WhatsApp.',
  compartilhamento: 'Gráfica Peregrina',
  imagem_compartilhamento: '',
  favicon: '',
  privacidade: '',
  contato_privacidade: '',
};

const secoes = [
  {
    id: 'inicio',
    titulo: 'Materiais gráficos para divulgar sua marca e organizar o dia a dia.',
    texto: 'Adesivos, wind banners, panfletos, sacolas, agendas, cadernos e apostilas. Escolha o que você precisa e converse com a Peregrina sobre o seu pedido.',
    chamada: 'Solicitar orçamento pelo WhatsApp',
    visivel: true,
    posicao: 0,
    imagem_id: '',
    passos: [],
  },
  {
    id: 'produtos',
    titulo: 'O que vamos imprimir?',
    texto: 'Encontre o material para a sua ideia. Os detalhes, a gente conversa no orçamento.',
    chamada: 'Ver catálogo de produtos',
    visivel: true,
    posicao: 1,
    imagem_id: '',
    passos: [],
  },
  {
    id: 'como-pedir',
    titulo: 'Começa com uma conversa.',
    texto: 'Escolha o material e compartilhe os detalhes para solicitar um orçamento.',
    chamada: 'Falar com a Peregrina',
    visivel: true,
    posicao: 2,
    imagem_id: '',
    passos: [
      { titulo: 'Escolha o material', texto: 'Conte qual produto você procura e como pretende usá-lo.' },
      { titulo: 'Compartilhe sua ideia', texto: 'Informe a quantidade desejada. Se tiver uma arte ou referência, envie também.' },
      { titulo: 'Converse sobre os detalhes', texto: 'Combine as possibilidades e receba o orçamento pelo WhatsApp.' },
      { titulo: 'Acompanhe seu pedido', texto: 'Após a aprovação, combine a produção e a forma de receber seu material.' },
    ],
  },
  {
    id: 'contato',
    titulo: 'Vamos colocar sua ideia no papel?',
    texto: 'Adesivos, materiais de divulgação e impressos para organizar suas ideias. Fale com a Peregrina sobre o que você precisa.',
    chamada: 'Solicitar orçamento',
    visivel: true,
    posicao: 3,
    imagem_id: '',
    passos: [],
  },
];

module.exports = { categorias, configuracoes, secoes };
