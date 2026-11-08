export function prepararSenhas() {
  document.querySelectorAll('[data-mostrar-senha]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const campo = document.getElementById(botao.dataset.mostrarSenha);
      const mostrar = campo.type === 'password';
      campo.type = mostrar ? 'text' : 'password';
      botao.textContent = mostrar ? 'Ocultar' : 'Mostrar';
      botao.setAttribute('aria-pressed', String(mostrar));
    });
  });
}

function mensagem(campo, form) {
  const valor = campo.value;
  if (campo.required && !valor.trim()) return 'Preencha este campo.';
  if (campo.type === 'email' && campo.validity.typeMismatch) return 'Informe um e-mail válido.';
  if (campo.name === 'codigo' && !/^\d{6}$/.test(valor)) return 'Digite os 6 dígitos do código.';
  if (campo.maxLength > 0 && valor.length > campo.maxLength) return 'O texto está muito longo.';
  if (campo.name === 'senha' && form.dataset.validarSenha !== undefined) {
    if (valor.length < 12) return 'Use pelo menos 12 caracteres.';
    if (new TextEncoder().encode(valor).length > 72) return 'Use até 72 bytes. Acentos ocupam mais de um byte.';
    if (!/[a-zA-Z]/.test(valor) || !/\d/.test(valor)) return 'Inclua letras e números.';
  }
  if (campo.name === 'confirmacao' && valor !== form.elements.senha.value) return 'As senhas não coincidem.';
  return '';
}

export function prepararFormulario(form, executar) {
  const estado = form.querySelector('[data-estado]');
  const campos = [...form.querySelectorAll('input:not([data-digito])')];
  function validar(campo) {
    const erro = mensagem(campo, form);
    document.getElementById(`${campo.id}-erro`).textContent = erro;
    campo.setAttribute('aria-invalid', String(Boolean(erro)));
    if (campo.name === 'codigo') form.querySelectorAll('[data-digito]')
      .forEach(digito => digito.setAttribute('aria-invalid', String(Boolean(erro))));
    return !erro;
  }
  campos.forEach((campo) => {
    campo.addEventListener('blur', () => validar(campo));
    campo.addEventListener('input', () => {
      if (campo.getAttribute('aria-invalid') === 'true') validar(campo);
    });
  });
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (form.dataset.enviando) return;
    const validos = campos.map(validar);
    if (validos.includes(false)) {
      const invalido = campos[validos.indexOf(false)];
      (invalido.name === 'codigo' ? form.querySelector('[data-digito]') : invalido).focus();
      return;
    }
    const botao = form.querySelector('[type="submit"]');
    const conteudoBotao = [...botao.childNodes];
    botao.textContent = 'Aguarde…';
    botao.disabled = true;
    form.setAttribute('aria-busy', 'true');
    form.dataset.enviando = 'sim';
    estado.textContent = 'Aguarde…';
    estado.setAttribute('role', 'status');
    try {
      await executar(Object.fromEntries(new FormData(form)), estado);
    } catch (erro) {
      estado.textContent = erro.message;
      estado.setAttribute('role', 'alert');
      if (erro.status === 409 && form.elements.nome) {
        const campo = form.elements.nome;
        document.getElementById(`${campo.id}-erro`).textContent = erro.message;
        campo.setAttribute('aria-invalid', 'true');
        campo.focus();
        estado.textContent = '';
      }
      if (erro.status === 401 && form.id) {
        estado.textContent += ' Se sua sessão terminou, entre novamente.';
      }
    } finally {
      botao.disabled = false;
      botao.replaceChildren(...conteudoBotao);
      form.removeAttribute('aria-busy');
      delete form.dataset.enviando;
    }
  });
}
