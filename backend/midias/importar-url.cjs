const https = require('node:https');
const dns = require('node:dns/promises');
const { BlockList, isIP } = require('node:net');
const { exigir } = require('../http/validacao.cjs');

const limiteBytes = 8 * 1024 * 1024;
const bloqueados = new BlockList();
for (const [rede, prefixo] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
  ['192.0.2.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
]) bloqueados.addSubnet(rede, prefixo, 'ipv4');
const globais = new BlockList();
globais.addSubnet('2000::', 3, 'ipv6');
bloqueados.addSubnet('2001::', 23, 'ipv6');
bloqueados.addSubnet('2001:db8::', 32, 'ipv6');
bloqueados.addSubnet('2002::', 16, 'ipv6');

function enderecoPublico(endereco) {
  const tipo = isIP(endereco);
  if (tipo === 4) return !bloqueados.check(endereco, 'ipv4');
  return tipo === 6 && globais.check(endereco, 'ipv6') && !bloqueados.check(endereco, 'ipv6');
}

function validarUrl(valor) {
  let url;
  try { url = new URL(valor); } catch { exigir(false, 'Informe um link válido para a imagem.'); }
  exigir(url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443'),
    'Use um link público de imagem que comece com https://.');
  return url;
}

async function importarUrl(valor) {
  exigir(typeof valor === 'string' && valor.length <= 2048, 'Informe o link da imagem.');
  const sinal = AbortSignal.timeout(15000);
  let url = validarUrl(valor);
  try {
    for (let tentativa = 0; tentativa < 4; tentativa += 1) {
      const host = url.hostname.replace(/^\[|\]$/g, '');
      const enderecos = isIP(host) ? [{ address: host, family: isIP(host) }]
        : await dns.lookup(host, { all: true });
      exigir(enderecos.length && enderecos.every((item) => enderecoPublico(item.address)),
        'Use um link público de imagem. Endereços locais não são permitidos.');
      sinal.throwIfAborted();
      const alvo = enderecos[0];
      const resposta = await new Promise((resolver, rejeitar) => {
        const pedido = https.get(url, {
          signal: sinal,
          headers: { Accept: 'image/jpeg,image/png,image/webp,image/avif', 'User-Agent': 'Peregrina-Image-Import/1.0' },
          // A conexão utiliza o endereço já verificado, sem uma segunda consulta DNS.
          lookup: (nome, opcoes, callback) => {
            if (opcoes.all) callback(null, [alvo]);
            else callback(null, alvo.address, alvo.family);
          },
        }, resolver);
        pedido.on('error', rejeitar);
      });
      if ([301, 302, 303, 307, 308].includes(resposta.statusCode)) {
        resposta.destroy();
        exigir(resposta.headers.location && tentativa < 3, 'O link redireciona muitas vezes. Use o link direto da imagem.');
        url = validarUrl(new URL(resposta.headers.location, url).href);
        continue;
      }
      if (resposta.statusCode !== 200 || Number(resposta.headers['content-length']) > limiteBytes) {
        resposta.destroy();
        exigir(false, 'Não foi possível importar. Confira o link direto da imagem e o limite de 8 MB.');
      }
      const partes = [];
      let bytes = 0;
      for await (const parte of resposta) {
        bytes += parte.length;
        if (bytes > limiteBytes) {
          resposta.destroy();
          exigir(false, 'Envie imagens com até 8 MB.', 413);
        }
        partes.push(parte);
      }
      exigir(bytes > 0, 'O link retornou um arquivo vazio.');
      return { buffer: Buffer.concat(partes), originalname: 'imagem-importada' };
    }
  } catch (erro) {
    if (erro.status) throw erro;
    exigir(false, 'Não foi possível baixar a imagem. Use um link direto público ou cole a imagem copiada.');
  }
}

module.exports = { importarUrl, enderecoPublico, validarUrl };
