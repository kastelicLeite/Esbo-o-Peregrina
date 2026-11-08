const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const carregar = (arquivo) => import(`data:text/javascript;base64,${Buffer.from(
  fs.readFileSync(path.join(__dirname, '../frontend/js/orcamento', arquivo), 'utf8'),
).toString('base64')}`);

function armazenamento() {
  const dados = new Map();
  return {
    getItem: (chave) => dados.get(chave) || null,
    setItem: (chave, valor) => dados.set(chave, valor),
  };
}

test('orçamento persiste configurações, evita duplicação e confirma edição antes de substituir', async () => {
  const { criarCarrinho } = await carregar('estado.js');
  const local = armazenamento();
  const carrinho = criarCarrinho(local);
  const item = { id: 'a', produto_id: 1, quantidade: 125, opcoes: { tamanho: 'p', cor: 'azul' },
    referencia: { nome: 'Produto', total_centavos: 10000 } };
  carrinho.adicionar(item);
  assert.equal(carrinho.adicionar({ ...item, id: 'b', opcoes: { cor: 'azul', tamanho: 'p' } }).duplicado, true);
  assert.equal(carrinho.ler().length, 1);
  carrinho.adicionar({ ...item, id: 'c', quantidade: 250 });
  assert.equal(carrinho.ler().length, 2);
  const restaurado = criarCarrinho(local);
  assert.equal(restaurado.ler()[0].quantidade, 125);
  const emEdicao = restaurado.ler()[0];
  emEdicao.quantidade = 500;
  assert.equal(restaurado.ler()[0].quantidade, 125);
  restaurado.adicionar(emEdicao, 'a');
  assert.equal(restaurado.ler()[0].quantidade, 500);
  restaurado.adicionar({ ...emEdicao, quantidade: 250 }, 'a');
  assert.equal(restaurado.ler().length, 1);
  assert.throws(() => restaurado.adicionar(item, 'removido'), /removido/);
  restaurado.remover('c');
  assert.equal(criarCarrinho(local).ler().length, 0);
  restaurado.adicionar(item);
  restaurado.limpar();
  assert.equal(criarCarrinho(local).ler().length, 0);
});

test('orçamento rejeita formatos corrompidos e armazenamento bloqueado', async () => {
  const { criarCarrinho } = await carregar('estado.js');
  assert.equal(criarCarrinho({ getItem: () => '{quebrado' }).falhaLeitura(), true);
  const carrinho = criarCarrinho({ getItem: () => null, setItem: () => { throw new Error('bloqueado'); } });
  assert.throws(() => carrinho.adicionar({ produto_id: 1, quantidade: 10, opcoes: {} }), /armazenamento/);
  assert.equal(carrinho.ler().length, 0);
});

test('WhatsApp inclui todos os itens, subtotal misto e alternativa sem truncamento', async () => {
  const { mensagemOrcamento, prepararLinkOrcamento } = await carregar('mensagem.js');
  const dados = { pode_enviar: true, subtotal_centavos: 4500, com_preco: 1, sob_orcamento: 1, itens: [
    { nome: 'Cartão', quantidade: 500, especificacoes: [{ nome: 'Material', valor: 'Couché' }], total_centavos: 4500, unitario_centavos: 9 },
    { nome: 'Sacola', quantidade: 125, especificacoes: [{ nome: 'Cor', valor: 'Azul' }], total_centavos: null, unitario_centavos: null },
  ] };
  const mensagem = mensagemOrcamento(dados);
  assert.match(mensagem, /1\. Cartão/);
  assert.match(mensagem, /2\. Sacola/);
  assert.match(mensagem, /Material: Couché/);
  assert.match(mensagem, /500 unidades \(1 lote\)/);
  assert.match(mensagem, /Subtotal dos itens com preço \(preço aproximado\): R\$\s45,00/);
  assert.match(mensagem, /Sob orçamento/);
  dados.itens[0].aproximado = true;
  const aproximada = mensagemOrcamento(dados);
  assert.match(aproximada, /Preço aproximado do item: R\$\s45,00/);
  assert.match(aproximada, /Subtotal dos itens com preço \(preço aproximado\)/);
  assert.match(mensagem, /Preço aproximado do item/);
  const curto = prepararLinkOrcamento('5511911116541', mensagem);
  assert.equal(new URL(curto.link).searchParams.get('text'), mensagem);
  const longo = prepararLinkOrcamento('5511911116541', mensagem, 10);
  assert.equal(longo.precisaCopiar, true);
  assert.equal(longo.link, 'https://wa.me/5511911116541');
  assert.match(mensagem, /2\. Sacola/);
  assert.throws(() => mensagemOrcamento({ pode_enviar: false }), /Revise/);
});
