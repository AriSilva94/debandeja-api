export const MAIL_QUEUE = 'mail';

export type MailJobName =
  | 'invite'
  | 'email-verification'
  | 'password-reset'
  | 'email-change'
  | 'team-update'
  | 'daily-digest';

export type InviteJobData = {
  to: string;
  tenantName: string;
  inviterName: string;
  acceptUrl: string;
};

export type EmailVerificationJobData = {
  to: string;
  name: string;
  verifyUrl: string;
};

export type PasswordResetJobData = {
  to: string;
  name: string;
  resetUrl: string;
};

export type EmailChangeJobData = {
  to: string;
  name: string;
  confirmUrl: string;
};

export type TeamUpdateJobData = {
  to: string;
  name: string;
  tenantName: string;
  summary: string;
  teamUrl: string;
};

type MovementTotals = { count: number; units: number };

export type DailyDigestJobData = {
  to: string;
  name: string;
  tenantName: string;
  day: string;
  movements?: {
    entries: MovementTotals;
    exits: MovementTotals;
    adjustments: MovementTotals;
  };
  alerts: {
    product: string;
    branch: string;
    current: number;
    min: number;
    out: boolean;
  }[];
  alertsTotal: number;
  stockUrl: string;
};
