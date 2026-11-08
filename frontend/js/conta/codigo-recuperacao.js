export function prepararCodigo() {
  const grupo = document.querySelector('[data-digitos-codigo]');
  if (!grupo) return;
  const codigo = document.getElementById('codigo');
  const campos = [];
  function atualizar() {
    codigo.value = campos.map(campo => campo.value).join('');
    codigo.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function preencher(texto, indice) {
    const digitos = texto.replace(/\D/g, '').slice(0, 6);
    if (!digitos) return;
    const inicio = digitos.length === 6 ? 0 : indice;
    for (let i = inicio; i < 6; i++) campos[i].value = digitos[i - inicio] || '';
    atualizar();
    campos[Math.min(inicio + digitos.length, 5)].focus();
  }
  for (let indice = 0; indice < 6; indice++) {
    const campo = document.createElement('input');
    campo.type = 'text';
    campo.inputMode = 'numeric';
    campo.autocomplete = indice === 0 ? 'one-time-code' : 'off';
    campo.dataset.digito = '';
    campo.setAttribute('aria-label', `Dígito ${indice + 1} de 6`);
    campo.setAttribute('aria-describedby', 'codigo-erro');
    campo.addEventListener('focus', () => campo.select());
    campo.addEventListener('input', () => {
      if (campo.value.replace(/\D/g, '').length > 1) preencher(campo.value, indice);
      else {
        campo.value = campo.value.replace(/\D/g, '').slice(0, 1);
        atualizar();
        if (campo.value && indice < 5) campos[indice + 1].focus();
      }
    });
    campo.addEventListener('paste', evento => {
      evento.preventDefault();
      preencher(evento.clipboardData.getData('text'), indice);
    });
    campo.addEventListener('keydown', evento => {
      if (evento.key === 'Backspace' && !campo.value && indice > 0) {
        evento.preventDefault();
        campos[indice - 1].value = '';
        campos[indice - 1].focus();
        atualizar();
      } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') {
        evento.preventDefault();
        campos[Math.max(0, Math.min(5, indice + (evento.key === 'ArrowLeft' ? -1 : 1)))].focus();
      }
    });
    campos.push(campo);
    grupo.append(campo);
  }
  codigo.form.addEventListener('reset', () => {
    campos.forEach(campo => { campo.value = ''; campo.removeAttribute('aria-invalid'); });
    codigo.removeAttribute('aria-invalid');
    document.getElementById('codigo-erro').textContent = '';
  });
}
