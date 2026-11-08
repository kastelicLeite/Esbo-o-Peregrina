function mensagemRecuperacao(codigo) {
  const texto = `Seu código de recuperação é: ${codigo}\n\nDigite este código na página da Gráfica Peregrina em até 10 minutos para escolher uma nova senha. Ele só pode ser usado uma vez.\n\nNão compartilhe este código. Nossa equipe não pede seu código nem sua senha.\n\nSe você não solicitou a troca de senha, ignore esta mensagem. Sua senha continua a mesma.\n\nGráfica Peregrina`;
  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f6f8;color:#16232d;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">Seu código para recuperar o acesso à Gráfica Peregrina. Válido por 10 minutos.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f8;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #dde5eb;border-radius:12px;">
        <tr><td style="padding:32px 28px 24px;">
          <p style="margin:0;font-size:24px;font-weight:700;letter-spacing:-1px;">Gráfica Peregrina<span style="color:#00aeef;">.</span></p>
          <p style="margin:8px 0 0;font-size:11px;letter-spacing:2px;color:#647584;">CUIDANDO DO SEU ACESSO</p>
        </td></tr>
        <tr><td style="padding:0 28px;">
          <table role="presentation" width="112" cellspacing="0" cellpadding="0"><tr>
            <td width="28" height="4" bgcolor="#00aeef"></td><td width="28" bgcolor="#ec008c"></td>
            <td width="28" bgcolor="#fff200"></td><td width="28" bgcolor="#16232d"></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px 28px 28px;">
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;letter-spacing:-0.5px;">Vamos recuperar sua conta?</h1>
          <p style="margin:0 0 24px;color:#536574;font-size:16px;line-height:1.6;">Use o código abaixo na página de recuperação para escolher uma nova senha.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edfaff;border:1px solid #b7e7f5;border-radius:8px;">
            <tr><td align="center" style="padding:22px 8px;">
              <p style="margin:0 0 10px;color:#376273;font-size:11px;font-weight:700;letter-spacing:1.5px;">SEU CÓDIGO DE RECUPERAÇÃO</p>
              <p style="margin:0;color:#006e8e;font-family:Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:6px;">${codigo}</p>
            </td></tr>
          </table>
          <p style="margin:14px 0 24px;font-size:13px;line-height:1.6;color:#647584;">Válido por <strong>10 minutos</strong> e para uma única utilização.</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;"><strong>Este código é só seu.</strong> Nossa equipe não pede seu código nem sua senha.</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#647584;">Não solicitou a troca? Ignore este e-mail. Sua senha continua a mesma.</p>
        </td></tr>
        <tr><td style="border-top:1px solid #e7edf1;padding:20px 28px;color:#647584;font-size:12px;line-height:1.6;">Gráfica Peregrina<br>Mensagem automática de segurança da sua conta.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { texto, html };
}

module.exports = { mensagemRecuperacao };
