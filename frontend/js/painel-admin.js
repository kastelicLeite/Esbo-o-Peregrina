const dialogo = document.querySelector('#acesso-admin');

if (dialogo) {
  const abrir = document.querySelector('#abrir-admin');
  const cancelar = document.querySelector('#cancelar-admin');
  const formulario = document.querySelector('#formulario-admin');
  const senha = document.querySelector('#senha-admin');
  const erro = document.querySelector('#erro-admin');

  abrir.addEventListener('click', () => {
    formulario.reset();
    erro.textContent = '';
    senha.removeAttribute('aria-invalid');
    dialogo.showModal();
    senha.focus();
  });

  cancelar.addEventListener('click', () => {
    dialogo.close();
  });

  senha.addEventListener('input', () => {
    erro.textContent = '';
    senha.removeAttribute('aria-invalid');
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const entrar = formulario.querySelector('[type="submit"]');
    entrar.disabled = true;

    try {
      const resposta = await fetch('/admin/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha: senha.value }),
      });

      if (!resposta.ok) {
        erro.textContent = resposta.status === 401
          ? 'Senha incorreta. Tente novamente.'
          : 'Não foi possível entrar. Tente novamente em instantes.';
        senha.setAttribute('aria-invalid', 'true');
        senha.focus();
        return;
      }

      senha.value = '';
      window.location.assign('/paginas/painel-admin.html');
    } catch {
      erro.textContent = 'Não foi possível conectar. Tente novamente.';
    } finally {
      entrar.disabled = false;
    }
  });
}

if (document.body.dataset.pagina === 'painel-admin') {
  document.querySelector('#conteudo-admin').hidden = false;

  document.querySelector('#sair-admin').addEventListener('click', async () => {
    try {
      const resposta = await fetch('/admin/sair', { method: 'POST' });
      if (resposta.ok) window.location.replace('/');
    } catch {
      window.location.reload();
    }
  });
}
