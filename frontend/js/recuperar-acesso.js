const form = document.querySelector('#recuperar-acesso');
const estado = document.querySelector('#estado-recuperacao');
const token = new URLSearchParams(location.search).get('token');
history.replaceState(null, '', location.pathname);

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const botao = form.querySelector('button');
  botao.disabled = true;
  try {
    const dados = new FormData(form);
    if (dados.get('senha') !== dados.get('confirmacao')) throw new Error('As senhas não coincidem.');
    const resposta = await fetch('/api/acesso/recuperar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, senha: dados.get('senha') }),
    });
    const resultado = await resposta.json();
    if (!resposta.ok) throw new Error(resultado.erro);
    form.reset();
    form.hidden = true;
    estado.textContent = 'Senha atualizada. Entre no painel com a nova senha.';
  } catch (erro) {
    estado.textContent = erro.message;
  } finally {
    botao.disabled = false;
  }
});
