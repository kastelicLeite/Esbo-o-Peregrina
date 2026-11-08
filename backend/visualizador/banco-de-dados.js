import { iniciarSessao, requisitar } from '/js/admin/api.js';
import { elemento } from '/js/admin/interface.js';

const seletor = document.querySelector('#tabela-banco');
const area = document.querySelector('#dados-banco');
const estado = document.querySelector('#estado-banco');
const erro = document.querySelector('#erro-banco');
const anterior = document.querySelector('#anterior-banco');
const proxima = document.querySelector('#proxima-banco');
let pagina = 1;
let assinatura = '';
let consultando = false;
let temporizador;
const termo = document.querySelector('#termo-banco');
const estadoPesquisa = document.querySelector('#estado-pesquisa-banco');
const resultadoAnterior = document.querySelector('#resultado-anterior-banco');
const resultadoProximo = document.querySelector('#resultado-proximo-banco');
let resultadoPesquisa;
let versaoPesquisa = 0;
let esperaPesquisa;
let rolarPendente = false;

function destacarPesquisa() {
  area.querySelectorAll('.registro-encontrado, .celula-encontrada').forEach((item) =>
    item.classList.remove('registro-encontrado', 'celula-encontrada'));
  if (!resultadoPesquisa?.total || pagina !== resultadoPesquisa.pagina) return;
  const linha = area.querySelectorAll('tbody tr')[resultadoPesquisa.linha];
  const cabecalhos = [...area.querySelectorAll('thead th strong')];
  const indice = cabecalhos.findIndex((item) => item.textContent === resultadoPesquisa.coluna);
  const celula = linha?.children[indice];
  if (!celula) return;
  linha.classList.add('registro-encontrado');
  celula.classList.add('celula-encontrada');
  if (!rolarPendente) return;
  celula.querySelectorAll('details').forEach((item) => { item.open = true; });
  const limites = celula.getBoundingClientRect();
  const quadro = area.getBoundingClientRect();
  area.scrollTo({ top: area.scrollTop + limites.top - quadro.top - area.clientHeight / 2,
    left: area.scrollLeft + limites.left - quadro.left - area.clientWidth / 2,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  rolarPendente = false;
}

async function localizar(indice = 0) {
  const versao = ++versaoPesquisa;
  if (!termo.value.trim() || seletor.disabled) {
    resultadoPesquisa = null;
    resultadoAnterior.disabled = resultadoProximo.disabled = true;
    estadoPesquisa.textContent = 'A pesquisa leva até o registro sem esconder as outras linhas.';
    destacarPesquisa();
    return;
  }
  estadoPesquisa.textContent = 'Localizando…';
  try {
    const resultado = await requisitar(`/api/admin/banco/${encodeURIComponent(seletor.value)}/localizar?${new URLSearchParams({ busca: termo.value.trim(), indice })}`);
    if (versao !== versaoPesquisa) return;
    resultadoPesquisa = resultado;
    resultadoAnterior.disabled = resultadoProximo.disabled = resultado.total < 2;
    estadoPesquisa.textContent = resultado.total
      ? `Resultado ${resultado.indice + 1} de ${resultado.total} · coluna ${resultado.coluna}` : 'Nenhum registro encontrado.';
    rolarPendente = Boolean(resultado.total);
    if (resultado.total && pagina !== resultado.pagina) {
      pagina = resultado.pagina;
      await atualizar();
    } else destacarPesquisa();
  } catch (falha) {
    if (versao === versaoPesquisa) estadoPesquisa.textContent = falha.message;
  }
}

function celula(valor) {
  const td = elemento('td');
  if (valor === null) td.append(elemento('span', { className: 'valor-nulo' }, 'NULL'));
  else {
    const texto = String(valor);
    if (texto.length > 160) td.append(elemento('details', {}, [
      elemento('summary', {}, `${texto.slice(0, 100)}…`), elemento('pre', {}, texto),
    ]));
    else td.textContent = texto;
  }
  return td;
}

async function atualizar() {
  if (consultando || !seletor.value) return;
  consultando = true;
  const tabela = seletor.value;
  const numero = pagina;
  try {
    const dados = await requisitar(`/api/admin/banco/${encodeURIComponent(tabela)}?pagina=${numero}`);
    if (tabela !== seletor.value || numero !== pagina) return;
    const paginas = Math.max(1, Math.ceil(dados.total / dados.tamanho));
    if (pagina > paginas) { pagina = paginas; return; }
    const novaAssinatura = JSON.stringify(dados);
    if (novaAssinatura !== assinatura) {
      const tabelaHtml = elemento('table', {}, [
        elemento('caption', {}, `Tabela ${dados.tabela}`),
        elemento('thead', {}, elemento('tr', {}, dados.colunas.map((coluna) =>
          elemento('th', { scope: 'col' }, [elemento('strong', {}, coluna.nome),
            elemento('small', {}, `${coluna.tipo}${coluna.chave ? ' · chave' : ''}`)])))),
        elemento('tbody', {}, dados.linhas.map((linha) => elemento('tr', {},
          dados.colunas.map((coluna) => celula(linha[coluna.nome]))))),
      ]);
      const rolagem = area.scrollLeft;
      area.replaceChildren(tabelaHtml);
      if (!dados.total) area.append(elemento('p', {}, 'Esta tabela ainda não possui registros.'));
      area.scrollLeft = rolagem;
      assinatura = novaAssinatura;
    }
    document.querySelector('#resumo-banco').textContent = `${dados.total} registros`;
    document.querySelector('#pagina-banco').textContent = `Página ${pagina} de ${paginas}`;
    anterior.disabled = pagina <= 1;
    proxima.disabled = pagina >= paginas;
    estado.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
    erro.hidden = true;
    destacarPesquisa();
  } catch (falha) {
    erro.textContent = falha.message;
    erro.hidden = false;
    estado.textContent = 'Sem atualização. Tentando novamente…';
  } finally {
    consultando = false;
    if (numero !== pagina || tabela !== seletor.value) atualizar();
  }
}

function consultarPagina(deslocamento = 0) {
  pagina = Math.max(1, pagina + deslocamento);
  atualizar();
}

seletor.addEventListener('change', () => {
  versaoPesquisa += 1;
  resultadoPesquisa = null;
  pagina = 1;
  assinatura = '';
  atualizar();
  localizar();
});
termo.addEventListener('input', () => {
  clearTimeout(esperaPesquisa);
  versaoPesquisa += 1;
  esperaPesquisa = setTimeout(() => localizar(), 300);
});
document.querySelector('#busca-banco').addEventListener('submit', (evento) => {
  evento.preventDefault();
  clearTimeout(esperaPesquisa);
  localizar();
});
resultadoAnterior.addEventListener('click', () => localizar((resultadoPesquisa.indice + resultadoPesquisa.total - 1) % resultadoPesquisa.total));
resultadoProximo.addEventListener('click', () => localizar(resultadoPesquisa.indice + 1));
anterior.addEventListener('click', () => consultarPagina(-1));
proxima.addEventListener('click', () => consultarPagina(1));
document.querySelector('#atualizar-banco').addEventListener('click', atualizar);
document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizar(); });
window.addEventListener('pagehide', () => clearInterval(temporizador));

try {
  const acesso = await iniciarSessao();
  if (!['administrador', 'criador'].includes(acesso.usuario.perfil)) throw new Error('Acesso restrito à administração.');
  const tabelas = await requisitar('/api/admin/banco');
  seletor.replaceChildren(...tabelas.map((tabela) => elemento('option', { value: tabela.nome }, tabela.nome)));
  seletor.disabled = false;
  await atualizar();
  temporizador = setInterval(() => { if (!document.hidden) atualizar(); }, 2000);
} catch (falha) {
  erro.textContent = falha.message;
  erro.hidden = false;
  estado.textContent = 'Não foi possível abrir o banco.';
}
