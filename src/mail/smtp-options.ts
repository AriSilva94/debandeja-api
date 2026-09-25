import type SMTPTransport from 'nodemailer/lib/smtp-transport';

type SmtpEnv = {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
};

export function smtpOptions(env: SmtpEnv): SMTPTransport.Options {
  const user = env.SMTP_USER?.trim();
  if (user && !env.SMTP_PASS) {
    throw new Error('SMTP_USER definido sem SMTP_PASS');
  }
  return {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: env.SMTP_SECURE === 'true',
    requireTLS: Boolean(user) && env.SMTP_SECURE !== 'true',
    ...(user ? { auth: { user, pass: env.SMTP_PASS } } : {}),
  };
}
