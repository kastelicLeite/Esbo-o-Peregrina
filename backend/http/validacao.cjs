class ErroPublico extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

function exigir(condicao, mensagem, status = 400) {
  if (!condicao) throw new ErroPublico(mensagem, status);
}

function texto(valor, limite, campo, obrigatorio = true) {
  exigir(typeof valor === 'string', `Informe ${campo}.`);
  const resultado = valor.trim();
  exigir((!obrigatorio || resultado.length > 0) && resultado.length <= limite,
    `Confira ${campo}: máximo de ${limite} caracteres.`);
  return resultado;
}

function inteiro(valor, minimo, maximo, campo) {
  const numero = Number(valor);
  exigir(Number.isSafeInteger(numero) && numero >= minimo && numero <= maximo,
    `Confira ${campo}.`);
  return numero;
}

function slug(valor) {
  const resultado = texto(valor, 160, 'o endereço amigável');
  exigir(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resultado),
    'Use letras minúsculas sem acentos, números e hífens no endereço.');
  return resultado;
}

function gerarSlug(valor) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'produto';
}

function dinheiro(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const entrada = String(valor).trim().replace(',', '.');
  exigir(/^\d{1,9}(\.\d{1,2})?$/.test(entrada), 'Informe um preço com até duas casas decimais.');
  const [reais, centavos = ''] = entrada.split('.');
  const total = Number(reais) * 100 + Number(centavos.padEnd(2, '0'));
  exigir(total > 0, 'O preço deve ser maior que zero; use sob orçamento quando não houver preço.');
  return total;
}

module.exports = { ErroPublico, exigir, texto, inteiro, slug, gerarSlug, dinheiro };
