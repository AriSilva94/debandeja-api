import { smtpOptions } from './smtp-options';

describe('smtpOptions', () => {
  it('Mailpit local: sem autenticação e sem TLS', () => {
    expect(smtpOptions({ SMTP_HOST: 'localhost', SMTP_PORT: '1026' })).toEqual({
      host: 'localhost',
      port: 1026,
      secure: false,
      requireTLS: false,
    });
  });

  it('Hostinger na 465: TLS direto com usuário e senha', () => {
    expect(
      smtpOptions({
        SMTP_HOST: 'smtp.hostinger.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'auth@debandeja.store',
        SMTP_PASS: 'segredo',
      }),
    ).toEqual({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      requireTLS: false,
      auth: { user: 'auth@debandeja.store', pass: 'segredo' },
    });
  });

  it('porta 587 com autenticação exige STARTTLS', () => {
    const options = smtpOptions({
      SMTP_HOST: 'smtp.hostinger.com',
      SMTP_PORT: '587',
      SMTP_USER: 'auth@debandeja.store',
      SMTP_PASS: 'segredo',
    });
    expect(options.secure).toBe(false);
    expect(options.requireTLS).toBe(true);
  });

  it('usuário sem senha é erro de configuração', () => {
    expect(() =>
      smtpOptions({
        SMTP_HOST: 'h',
        SMTP_PORT: '465',
        SMTP_USER: 'auth@debandeja.store',
      }),
    ).toThrow('SMTP_USER definido sem SMTP_PASS');
  });
});
