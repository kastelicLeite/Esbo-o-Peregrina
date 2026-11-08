import { requisitar } from './api.js';
import { elemento } from './interface.js';

export function controleEstoque(produto) {
  const id = `estoque-produto-${produto.id}`;
  const form = elemento('form', { className: 'estoque-produto-admin', 'aria-label': `Estoque de ${produto.nome}` });
  const entrada = elemento('input', { id, type: 'number', min: 0, max: 10000000, step: 1,
    value: produto.estoque ?? '', placeholder: 'Sem controle', inputMode: 'numeric' });
  const salvar = elemento('button', { type: 'submit', className: 'botao-secundario', disabled: true }, 'Salvar estoque');
  const status = elemento('small', { role: 'status', id: `${id}-estado` });
  entrada.setAttribute('aria-describedby', status.id);
  let atual = produto.estoque ?? null;
  let salvando = false;
  const valor = () => entrada.value === '' ? null : Number(entrada.value);
  function descrever() {
    status.textContent = atual === null ? 'Sem controle de estoque' : atual === 0 ? 'Sem estoque'
      : `${atual.toLocaleString('pt-BR')} unidades em estoque`;
    status.classList.toggle('estoque-zerado', atual === 0);
  }
  entrada.addEventListener('input', () => {
    salvar.disabled = salvando || valor() === atual;
    if (valor() !== atual) status.textContent = 'Alteração ainda não salva';
    else descrever();
  });
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (salvando || !form.reportValidity()) return;
    const manterFoco = form.contains(document.activeElement);
    salvando = true;
    salvar.disabled = true;
    entrada.disabled = true;
    status.textContent = 'Salvando estoque…';
    try {
      const resposta = await requisitar(`/api/admin/produtos/${produto.id}/estoque`, {
        method: 'PUT', body: { estoque: valor(), estoque_anterior: atual },
      });
      atual = resposta.estoque;
      produto.estoque = atual;
      produto.atualizado_em = resposta.atualizado_em;
      descrever();
    } catch (erro) {
      status.textContent = erro.message;
    } finally {
      salvando = false;
      entrada.disabled = false;
      salvar.disabled = valor() === atual;
      if (manterFoco && (document.activeElement === document.body || form.contains(document.activeElement))) {
        entrada.focus({ preventScroll: true });
      }
    }
  });
  form.append(elemento('label', { htmlFor: id }, 'Estoque (unidades)'),
    elemento('div', { className: 'entrada-estoque-admin' }, [entrada, salvar]), status,
    elemento('small', { className: 'ajuda-estoque-admin' }, 'Deixe vazio para não controlar.'));
  descrever();
  return form;
}
