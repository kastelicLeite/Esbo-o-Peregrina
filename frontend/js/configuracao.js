export const configuracao = {
  whatsapp: '5511911116541',
  telefoneExibido: '+55 (11) 91111-6541',
  logo: 'assets/imagens/logo-peregrina.png',
  mensagemGeral: 'Olá! Gostaria de solicitar um orçamento com a Gráfica Peregrina.',
  mensagemProduto: (produto) => `Olá! Gostaria de solicitar um orçamento de ${produto.toLowerCase()}.`,
};

export const produtos = [
  {
    nome: 'Adesivos',
    descricao: 'Sua identidade nos detalhes: para identificar, personalizar e divulgar.',
    foto: null,
    classe: 'adesivos',
  },
  {
    nome: 'Wind banners',
    descricao: 'Presença visual para apresentar sua marca e chamar a atenção.',
    foto: null,
    classe: 'banners',
  },
  {
    nome: 'Panfletos',
    descricao: 'Suas informações e novidades em um material feito para circular.',
    foto: null,
    classe: 'panfletos',
  },
  {
    nome: 'Sacolas',
    descricao: 'Uma forma de levar sua marca junto com cada entrega.',
    foto: null,
    classe: 'sacolas',
  },
  {
    nome: 'Agendas e cadernos',
    descricao: 'Espaço para planos, anotações e novas ideias no dia a dia.',
    foto: null,
    classe: 'cadernos',
  },
  {
    nome: 'Apostilas',
    descricao: 'Conteúdo impresso para acompanhar o estudo e o aprendizado.',
    foto: null,
    classe: 'apostilas',
  },
];

export function linkWhatsapp(produto) {
  const mensagem = produto
    ? configuracao.mensagemProduto(produto)
    : configuracao.mensagemGeral;
  return `https://wa.me/${configuracao.whatsapp}?text=${encodeURIComponent(mensagem)}`;
}
