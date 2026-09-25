import type {
  DailyDigestJobData,
  EmailChangeJobData,
  EmailVerificationJobData,
  InviteJobData,
  PasswordResetJobData,
  TeamUpdateJobData,
} from '../mail-job.type';
import {
  COLORS,
  h,
  paragraph,
  renderLayout,
  sectionTitle,
  strong,
} from './layout';

export type RenderedEmail = { subject: string; text: string; html: string };

const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function hours(value: number) {
  return value === 1 ? '1 hora' : `${value} horas`;
}

function plain(lines: (string | false | undefined)[]) {
  return lines
    .filter((line) => line !== false && line !== undefined)
    .join('\n');
}

export function verificationEmail(
  data: EmailVerificationJobData,
  appUrl: string,
): RenderedEmail {
  const validity = `O link vale por ${hours(data.expiresInHours)}.`;
  return {
    subject: 'Confirme seu e-mail no Debandeja',
    text: plain([
      `Olá, ${data.name}!`,
      '',
      'Falta um passo para ativar sua conta no Debandeja: confirme seu e-mail.',
      '',
      `Confirmar e-mail: ${data.verifyUrl}`,
      '',
      `${validity} Se você não criou uma conta, ignore este e-mail.`,
    ]),
    html: renderLayout({
      appUrl,
      preheader: 'Falta um passo para ativar sua conta.',
      heading: 'Confirme seu e-mail',
      content:
        paragraph(`Olá, ${strong(data.name)}!`) +
        paragraph(
          'Falta um passo para ativar sua conta no Debandeja. Confirme seu e-mail para continuar o cadastro da sua distribuidora.',
        ),
      cta: { label: 'Confirmar e-mail', url: data.verifyUrl },
      note: `${validity} Se você não criou uma conta no Debandeja, ignore este e-mail.`,
      reason: `Você recebeu este e-mail porque ${data.to} foi usado para criar uma conta.`,
    }),
  };
}

export function passwordResetEmail(
  data: PasswordResetJobData,
  appUrl: string,
): RenderedEmail {
  const validity = `O link vale por ${hours(data.expiresInHours)} e só pode ser usado uma vez.`;
  return {
    subject: 'Redefina sua senha do Debandeja',
    text: plain([
      `Olá, ${data.name}!`,
      '',
      'Recebemos um pedido para redefinir a senha da sua conta.',
      '',
      `Criar nova senha: ${data.resetUrl}`,
      '',
      `${validity} Se não foi você, ignore este e-mail: sua senha atual continua valendo.`,
    ]),
    html: renderLayout({
      appUrl,
      preheader: 'Crie uma nova senha para sua conta.',
      heading: 'Redefina sua senha',
      content:
        paragraph(`Olá, ${strong(data.name)}!`) +
        paragraph(
          'Recebemos um pedido para redefinir a senha da sua conta no Debandeja. Clique no botão para criar uma nova.',
        ),
      cta: { label: 'Criar nova senha', url: data.resetUrl },
      note: `${validity} Se não foi você, ignore este e-mail: sua senha atual continua valendo e ninguém entra na sua conta sem ela.`,
      reason: `Você recebeu este e-mail porque alguém pediu para redefinir a senha de ${data.to}.`,
    }),
  };
}

export function inviteEmail(
  data: InviteJobData,
  appUrl: string,
): RenderedEmail {
  const validity = `O convite vale por ${hours(data.expiresInHours)}.`;
  return {
    subject: `${data.inviterName} convidou você para ${data.tenantName} no Debandeja`,
    text: plain([
      `${data.inviterName} convidou você para fazer parte da equipe de ${data.tenantName} no Debandeja.`,
      '',
      `Aceitar convite: ${data.acceptUrl}`,
      '',
      `${validity} Se você não esperava este convite, ignore este e-mail.`,
    ]),
    html: renderLayout({
      appUrl,
      preheader: `${data.inviterName} convidou você para a equipe de ${data.tenantName}.`,
      heading: `Você foi convidado para ${data.tenantName}`,
      content:
        paragraph(
          `${strong(data.inviterName)} convidou você para fazer parte da equipe de ${strong(data.tenantName)} no Debandeja, o sistema de estoque e operação da distribuidora.`,
        ) +
        paragraph(
          'Ao aceitar, você define seu nome e sua senha e já entra com acesso às filiais liberadas para você.',
        ),
      cta: { label: 'Aceitar convite', url: data.acceptUrl },
      note: `${validity} Se você não esperava este convite, ignore este e-mail.`,
      reason: `Você recebeu este e-mail porque foi convidado para uma equipe no Debandeja.`,
    }),
  };
}

export function emailChangeEmail(
  data: EmailChangeJobData,
  appUrl: string,
): RenderedEmail {
  const validity = `O link vale por ${hours(data.expiresInHours)}.`;
  return {
    subject: 'Confirme seu novo e-mail no Debandeja',
    text: plain([
      `Olá, ${data.name}!`,
      '',
      'Confirme este endereço para passar a usá-lo no login do Debandeja.',
      '',
      `Confirmar novo e-mail: ${data.confirmUrl}`,
      '',
      `${validity} Se não foi você, ignore este e-mail: seu e-mail atual continua valendo.`,
    ]),
    html: renderLayout({
      appUrl,
      preheader: 'Confirme o novo endereço para usá-lo no login.',
      heading: 'Confirme seu novo e-mail',
      content:
        paragraph(`Olá, ${strong(data.name)}!`) +
        paragraph(
          'Você pediu para trocar o e-mail de acesso da sua conta. Confirme este endereço para passar a usá-lo no login.',
        ),
      cta: { label: 'Confirmar novo e-mail', url: data.confirmUrl },
      note: `${validity} Se não foi você, ignore este e-mail: o e-mail atual da conta continua valendo.`,
      reason: `Você recebeu este e-mail porque ${data.to} foi informado como novo e-mail de uma conta.`,
    }),
  };
}

export function teamUpdateEmail(
  data: TeamUpdateJobData,
  appUrl: string,
): RenderedEmail {
  return {
    subject: `${data.tenantName}: ${data.summary}`,
    text: plain([
      `Olá, ${data.name}!`,
      '',
      `${data.summary}.`,
      '',
      `Ver equipe: ${data.teamUrl}`,
      '',
      'Você recebe este aviso porque ativou "Convites e mudanças de permissão" em Configurações → Conta.',
    ]),
    html: renderLayout({
      appUrl,
      preheader: `${data.summary}.`,
      heading: 'Mudança na equipe',
      content:
        paragraph(`Olá, ${strong(data.name)}!`) +
        paragraph(`${strong(data.summary)} em ${strong(data.tenantName)}.`),
      cta: { label: 'Ver equipe', url: data.teamUrl },
      reason:
        'Você recebe este aviso porque ativou "Convites e mudanças de permissão" em Configurações → Conta.',
    }),
  };
}

const MOVEMENTS = [
  ['entries', 'Entradas'],
  ['exits', 'Saídas'],
  ['adjustments', 'Ajustes'],
] as const;

function statCell(
  label: string,
  count: number,
  units: string,
  isLast: boolean,
) {
  return `<td width="33%" valign="top" style="padding:14px 16px;${isLast ? '' : `border-right:1px solid ${COLORS.border};`}">
    <div style="font-family:${FONT};font-size:12.5px;line-height:18px;color:${COLORS.muted};">${h(label)}</div>
    <div style="font-family:${FONT};font-size:22px;line-height:30px;font-weight:600;color:${COLORS.heading};font-variant-numeric:tabular-nums;">${count}</div>
    <div style="font-family:${FONT};font-size:12.5px;line-height:18px;color:${COLORS.muted};font-variant-numeric:tabular-nums;">${h(units)} un.</div>
  </td>`;
}

function alertRow(
  alert: DailyDigestJobData['alerts'][number],
  isLast: boolean,
) {
  const pill = alert.out
    ? { label: 'Sem estoque', color: COLORS.errorText, bg: COLORS.errorBg }
    : { label: 'Baixo', color: COLORS.warningText, bg: COLORS.warningBg };
  return `<tr>
    <td style="padding:12px 0;${isLast ? '' : `border-bottom:1px solid ${COLORS.border};`}font-family:${FONT};">
      <div style="font-size:14px;line-height:20px;font-weight:600;color:${COLORS.heading};">${h(alert.product)}</div>
      <div style="font-size:12.5px;line-height:18px;color:${COLORS.muted};">${h(alert.branch)} · mínimo ${alert.min} un.</div>
    </td>
    <td align="right" valign="middle" style="padding:12px 0;${isLast ? '' : `border-bottom:1px solid ${COLORS.border};`}font-family:${FONT};white-space:nowrap;">
      <span style="font-size:14px;font-weight:600;color:${COLORS.heading};font-variant-numeric:tabular-nums;">${alert.current} un.</span>
      <span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background-color:${pill.bg};color:${pill.color};font-size:12px;line-height:18px;font-weight:600;">${pill.label}</span>
    </td>
  </tr>`;
}

export function dailyDigestEmail(
  data: DailyDigestJobData,
  appUrl: string,
): RenderedEmail {
  const { movements } = data;
  const signed = (key: (typeof MOVEMENTS)[number][0], units: number) => {
    if (key !== 'adjustments' || units === 0) return String(units);
    return units > 0 ? `+${units}` : `−${Math.abs(units)}`;
  };
  const moreAlerts = data.alertsTotal - data.alerts.length;

  const movementsHtml = movements
    ? sectionTitle('Movimentações') +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${COLORS.border};border-radius:12px;border-collapse:separate;">
        <tr>${MOVEMENTS.map(([key, label], index) => statCell(label, movements[key].count, signed(key, movements[key].units), index === MOVEMENTS.length - 1)).join('')}</tr>
      </table>`
    : '';
  const alertsHtml = data.alertsTotal
    ? sectionTitle(`Alertas de estoque (${data.alertsTotal})`) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${data.alerts.map((alert, index) => alertRow(alert, index === data.alerts.length - 1)).join('')}</table>` +
      (moreAlerts > 0
        ? paragraph(
            `E mais ${moreAlerts} ${moreAlerts === 1 ? 'alerta' : 'alertas'} no estoque.`,
          )
        : '')
    : sectionTitle('Alertas de estoque') +
      paragraph('Nenhum produto abaixo do mínimo nas filiais que você acessa.');

  return {
    subject: `${data.tenantName}: resumo de ${data.day}`,
    text: plain([
      `Olá, ${data.name}!`,
      `Resumo de ${data.day} em ${data.tenantName}.`,
      ...(movements
        ? [
            '',
            'Movimentações',
            ...MOVEMENTS.map(
              ([key, label]) =>
                `${label}: ${movements[key].count} (${signed(key, movements[key].units)} un.)`,
            ),
          ]
        : []),
      '',
      data.alertsTotal
        ? `Alertas de estoque (${data.alertsTotal})`
        : 'Nenhum alerta de estoque.',
      ...data.alerts.map(
        (a) =>
          `${a.product} — ${a.branch}: ${a.current} un. (mínimo ${a.min})${a.out ? ' · sem estoque' : ''}`,
      ),
      moreAlerts > 0 && `E mais ${moreAlerts}.`,
      '',
      `Abrir o estoque: ${data.stockUrl}`,
    ]),
    html: renderLayout({
      appUrl,
      preheader: data.alertsTotal
        ? `${data.alertsTotal} ${data.alertsTotal === 1 ? 'alerta' : 'alertas'} de estoque em ${data.tenantName}.`
        : `Resumo da operação de ${data.tenantName}.`,
      heading: `Resumo de ${data.day}`,
      content:
        paragraph(
          `Olá, ${strong(data.name)}! Veja como foi o dia em ${strong(data.tenantName)}.`,
        ) +
        movementsHtml +
        alertsHtml,
      cta: { label: 'Abrir o estoque', url: data.stockUrl },
      reason:
        'Você recebe este resumo pelas preferências de e-mail em Configurações.',
    }),
  };
}
