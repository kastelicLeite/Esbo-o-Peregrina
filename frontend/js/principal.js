import './cabecalho.js';
import { atualizarSite } from './site-publico.js';
import { montarMateriais } from './inicio/materiais.js';
import { iniciarFormulario } from './inicio/formulario.js';

montarMateriais();
iniciarFormulario();

try {
  await atualizarSite(true);
} catch {
  const aviso = document.createElement('p');
  aviso.className = 'estado-produtos largura';
  aviso.setAttribute('role', 'status');
  aviso.textContent = 'Não foi possível atualizar as informações do site. Tente recarregar a página.';
  document.querySelector('main').prepend(aviso);
}
