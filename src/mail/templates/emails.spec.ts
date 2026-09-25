import {
  dailyDigestEmail,
  inviteEmail,
  passwordResetEmail,
  verificationEmail,
} from './emails';

const APP_URL = 'https://dev.debandeja.store';

describe('templates de e-mail', () => {
  it('confirmação: botão, link de apoio, validade e logo do domínio certo', () => {
    const email = verificationEmail(
      {
        to: 'ana@distribuidora.com',
        name: 'Ana',
        verifyUrl: `${APP_URL}/verificar-email?token=u.1`,
        expiresInHours: 24,
      },
      APP_URL,
    );
    expect(email.subject).toBe('Confirme seu e-mail no Debandeja');
    expect(email.html).toContain('>Confirmar e-mail</a>');
    expect(email.html).toContain(`${APP_URL}/verificar-email?token=u.1`);
    expect(email.html).toContain(`${APP_URL}/email-logo.png`);
    expect(email.html).toContain('O link vale por 24 horas.');
    expect(email.text).toContain(
      `Confirmar e-mail: ${APP_URL}/verificar-email?token=u.1`,
    );
  });

  it('validade no singular', () => {
    const email = passwordResetEmail(
      { to: 'a@b.com', name: 'Ana', resetUrl: 'x', expiresInHours: 1 },
      APP_URL,
    );
    expect(email.html).toContain('O link vale por 1 hora ');
  });

  it('escapa nomes digitados por usuários', () => {
    const email = inviteEmail(
      {
        to: 'a@b.com',
        tenantName: 'Bebidas <script>',
        inviterName: 'Ana "Admin"',
        acceptUrl: 'https://x/aceitar',
        expiresInHours: 48,
      },
      APP_URL,
    );
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('Bebidas &lt;script&gt;');
    expect(email.html).toContain('Ana &quot;Admin&quot;');
  });

  it('resumo diário: números, selo de status e produto escapado', () => {
    const email = dailyDigestEmail(
      {
        to: 'a@b.com',
        name: 'Ana',
        tenantName: 'Silva',
        day: '23/09/2026',
        movements: {
          entries: { count: 1, units: 5 },
          exits: { count: 2, units: 75 },
          adjustments: { count: 1, units: 3 },
        },
        alerts: [
          {
            product: 'Heineken <b>',
            branch: 'Matriz',
            current: 0,
            min: 50,
            out: true,
          },
        ],
        alertsTotal: 1,
        stockUrl: `${APP_URL}/estoque`,
      },
      APP_URL,
    );
    expect(email.html).toContain('Heineken &lt;b&gt;');
    expect(email.html).toContain('Sem estoque');
    expect(email.html).toContain('+3 un.');
    expect(email.text).toContain('Saídas: 2 (75 un.)');
  });
});
