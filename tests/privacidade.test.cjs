const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const carregar = async () => import('data:text/javascript;base64,' + Buffer.from(
  fs.readFileSync('frontend/js/privacidade/solicitacao.js', 'utf8')).toString('base64'));

test('solicitação de privacidade prepara texto sem confirmar exclusão ou envio', async () => {
  const { prepararSolicitacao } = await carregar();
  const dados = { tipo: 'exclusao', email: 'cliente+teste@example.test', detalhes: 'Quero orientação & retorno.' };
  const resultado = prepararSolicitacao(dados, { whatsapp: '5511999999999' });
  assert.equal(resultado.email, null);
  assert.match(resultado.mensagem, /Solicitação de exclusão/);
  assert.match(resultado.mensagem, /cliente\+teste@example.test/);
  assert(!resultado.mensagem.includes('Conta excluída'));
  const url = new URL(resultado.whatsapp);
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.searchParams.get('text'), resultado.mensagem);
  const comEmail = prepararSolicitacao(dados, { email: 'contato@example.test', contato_privacidade: 'privacidade@example.test' });
  assert(comEmail.email.startsWith('mailto:privacidade@example.test?'));
  assert.equal(comEmail.whatsapp, null);
  const parametros = new URLSearchParams(comEmail.email.split('?')[1]);
  assert.equal(parametros.get('body'), comEmail.mensagem);
});

test('privacidade rejeita dados e canais inválidos sem inventar contato', async () => {
  const { prepararSolicitacao } = await carregar();
  const canal = { whatsapp: '5511999999999' };
  for (const dados of [
    { tipo: 'desconhecido', email: 'cliente@example.test' },
    { tipo: 'ajuda', email: 'invalido' },
    { tipo: 'ajuda', email: 'cliente@example.test\nBcc: outro@example.test' },
    { tipo: 'acesso', email: 'cliente@example.test', detalhes: 'a'.repeat(1001) },
  ]) assert.throws(() => prepararSolicitacao(dados, canal));
  assert.throws(() => prepararSolicitacao({ tipo: 'ajuda', email: 'cliente@example.test' },
    { whatsapp: 'javascript:alert(1)', email: 'javascript:alert(1)' }), /indisponível/);
});
