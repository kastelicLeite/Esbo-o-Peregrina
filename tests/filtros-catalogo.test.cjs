const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const modulo = import(pathToFileURL(path.join(__dirname, '../frontend/js/filtros-catalogo.js')).href);

test('filtros combinam categoria, características e preço por unidade', async () => {
  const { filtrarCatalogo, precoUnitario } = await modulo;
  const produtos = [
    { id: 1, categoria_id: 2, menor_preco: { total_centavos: 500, quantidade: 100 },
      caracteristicas: [{ nome: 'Material', tipo: 'fixa', valor: 'Vinil' }] },
    { id: 2, categoria_id: 2, menor_preco: { total_centavos: 4500, quantidade: 500 },
      caracteristicas: [{ nome: 'Material', tipo: 'selecao', valores: [{ nome: 'Couché' }] }] },
    { id: 3, categoria_id: 3, menor_preco: null, caracteristicas: [] },
  ];
  const filtros = { categoria: '', material: '', acabamento: '', minimo: '', maximo: '', tipo: '' };
  assert.equal(precoUnitario(produtos[0]), .05);
  assert.deepEqual(filtrarCatalogo(produtos, { ...filtros, categoria: '2', maximo: '.06' }).map(item => item.id), [1]);
  assert.deepEqual(filtrarCatalogo(produtos, { ...filtros, material: 'couche' }).map(item => item.id), [2]);
  assert.deepEqual(filtrarCatalogo(produtos, { ...filtros, tipo: 'orcamento' }).map(item => item.id), [3]);
  assert.equal(filtrarCatalogo(produtos, filtros).length, 3);
  assert.equal(filtrarCatalogo(produtos, { ...filtros, minimo: '10', maximo: '1' }).length, 0);
});
