/** Email-safe tables and inline styles; no external images or tracking. */
export function buildSecurityContactEmail(code: string) {
  if (!/^\d{8}$/.test(code)) throw new Error("Invalid confirmation code");
  return {
    subject: "Confirme seu e-mail alternativo — Go Atleta",
    text: `Go Atleta\n\nConfirme seu e-mail alternativo\n\nSeu código: ${code}\n\nDigite o código no app. Ele expira em 10 minutos.\nSeu e-mail de acesso permanece o mesmo.\n\nNão compartilhe este código. Se você não solicitou, ignore esta mensagem.`,
    html: `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Confirme seu e-mail alternativo</title></head>
<body style="margin:0;padding:0;background-color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;color:#0E1729;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Use o código para confirmar seu e-mail alternativo no Go Atleta.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background-color:#FFFDF8;border:1px solid #EBE3D2;border-radius:16px;">
<tr><td style="padding:24px;background-color:#0E1729;border-radius:16px 16px 0 0;border-bottom:3px solid #3DDC84;color:#FFFFFF;font-size:22px;font-weight:700;">Go Atleta</td></tr>
<tr><td style="padding:28px 24px 16px;">
<h1 style="margin:0 0 12px;font-size:22px;line-height:28px;font-weight:700;">Confirme seu e-mail alternativo</h1>
<p style="margin:0;color:#5A6B82;font-size:15px;line-height:23px;">Digite este código no app:</p>
</td></tr>
<tr><td style="padding:0 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:22px 8px;background-color:#F5F0E8;border:1px solid #EBE3D2;border-radius:12px;font-family:Consolas,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:4px;line-height:40px;color:#0E1729;">${code}</td></tr></table>
<p style="margin:12px 0 0;text-align:center;color:#5A6B82;font-size:13px;line-height:20px;">Válido por <strong>10 minutos</strong>.</p>
</td></tr>
<tr><td style="padding:24px;font-size:14px;line-height:22px;">
<p style="margin:0;">Seu e-mail de acesso permanece o mesmo.</p>
<p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #EBE3D2;color:#5A6B82;font-size:12px;line-height:19px;">Não compartilhe este código. Se você não solicitou, ignore esta mensagem.</p>
</td></tr></table>
</td></tr></table></body></html>`,
  };
}
