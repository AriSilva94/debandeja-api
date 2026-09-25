export const COLORS = {
  canvas: '#f7f6f1',
  brand: '#06543c',
  brandDark: '#023b2a',
  brandSubtle: '#edf6f0',
  accent: '#d89a18',
  heading: '#101828',
  text: '#475467',
  muted: '#667085',
  border: '#e4e7ec',
  warningText: '#b54708',
  warningBg: '#fffaeb',
  errorText: '#b42318',
  errorBg: '#fef3f2',
} as const;

const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function h(value: string | number) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function paragraph(html: string) {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${COLORS.text};">${html}</p>`;
}

export function strong(text: string) {
  return `<strong style="color:${COLORS.heading};font-weight:600;">${h(text)}</strong>`;
}

export function sectionTitle(text: string) {
  return `<p style="margin:24px 0 10px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.muted};">${h(text)}</p>`;
}

function button(label: string, url: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
  <tr>
    <td align="center" bgcolor="${COLORS.brand}" style="border-radius:10px;">
      <a href="${h(url)}" target="_blank" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${h(label)}</a>
    </td>
  </tr>
</table>`;
}

type LayoutParams = {
  appUrl: string;
  preheader: string;
  heading: string;
  content: string;
  cta?: { label: string; url: string };
  note?: string;
  reason: string;
};

export function renderLayout({
  appUrl,
  preheader,
  heading,
  content,
  cta,
  note,
  reason,
}: LayoutParams) {
  const fallbackLink = cta
    ? `<p style="margin:20px 0 0;font-family:${FONT};font-size:12.5px;line-height:19px;color:${COLORS.muted};">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${h(cta.url)}" style="color:${COLORS.brand};word-break:break-all;">${h(cta.url)}</a></p>`
    : '';
  const noteBlock = note
    ? `<p style="margin:20px 0 0;padding-top:20px;border-top:1px solid ${COLORS.border};font-family:${FONT};font-size:13px;line-height:20px;color:${COLORS.muted};">${h(note)}</p>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${h(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${h(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.canvas}" style="background-color:${COLORS.canvas};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td bgcolor="${COLORS.brand}" style="padding:22px 32px;border-radius:14px 14px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#ffffff" style="padding:6px 8px;border-radius:10px;">
                  <a href="${h(appUrl)}" target="_blank"><img src="${h(appUrl)}/email-logo.png" width="96" height="69" alt="Debandeja" style="display:block;border:0;width:96px;height:auto;font-family:${FONT};font-size:16px;font-weight:700;color:${COLORS.brand};"></a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td height="3" bgcolor="${COLORS.accent}" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td>
        </tr>
        <tr>
          <td bgcolor="#ffffff" style="padding:36px 32px 32px;border-radius:0 0 14px 14px;border:1px solid ${COLORS.border};border-top:0;">
            <h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:600;letter-spacing:-0.01em;color:${COLORS.heading};">${h(heading)}</h1>
            ${content}
            ${cta ? button(cta.label, cta.url) : ''}
            ${fallbackLink}
            ${noteBlock}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${COLORS.muted};text-align:center;">
            ${h(reason)}<br>
            <a href="${h(appUrl)}" style="color:${COLORS.muted};text-decoration:underline;">Debandeja</a> · Sistema para distribuidoras de bebidas
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
